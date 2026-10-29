import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, test } from 'vitest'

import { TEST_API_BASE_URL } from '../../../tests/constants'
import {
  addExpense,
  freezeToday,
  listedExpenses,
  monthHeading,
  monthTotal,
  plain,
  seedHousehold,
} from '../../../tests/expenses'
import { fakeBackend } from '../../../tests/msw/handlers'
import { server } from '../../../tests/msw/server'
import { renderApp } from '../../../tests/render-app'

beforeEach(() => freezeToday())

const search = (router: ReturnType<typeof renderApp>['router']) =>
  Object.fromEntries(new URLSearchParams(router.state.location.search))

describe('one month at a time', () => {
  test('without a month the current month is shown', async () => {
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '50000', 'Groceries')
    addExpense(household.id, '2026-09-28', '10000', 'Transport')
    renderApp('/expenses', { session: null })

    expect(await monthHeading('October 2026')).toBeInTheDocument()
    expect(await listedExpenses('October 2026')).toEqual([
      expect.stringMatching(/^Groceries.*Oct 3, 2026.*IDR 50,000\.00/),
    ])
  })

  test('the previous month is shown and put in the URL', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    addExpense(household.id, '2026-09-28', '10000', 'Transport')
    const { router } = renderApp('/expenses', { session: null })
    await monthHeading('October 2026')

    await user.click(screen.getByRole('button', { name: 'Previous month' }))

    expect(await monthHeading('September 2026')).toBeInTheDocument()
    expect(search(router)).toEqual({ month: '2026-09' })
    expect(await listedExpenses('September 2026')).toEqual([
      expect.stringMatching(/^Transport.*Sep 28, 2026/),
    ])
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(await monthHeading('October 2026')).toBeInTheDocument()
  })

  test('an invalid month in the URL shows the current month', async () => {
    seedHousehold()
    renderApp('/expenses?month=2026-13', { session: null })

    expect(await monthHeading('October 2026')).toBeInTheDocument()
  })
})

describe('the list', () => {
  test('is ordered newest first and shows category, date, amount, and note', async () => {
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '50000', 'Groceries', 'Weekly market')
    addExpense(household.id, '2026-10-12', '20000', 'Transport')
    renderApp('/expenses', { session: null })

    expect(await listedExpenses('October 2026')).toEqual([
      expect.stringMatching(/^Transport.*Oct 12, 2026.*IDR 20,000\.00/),
      expect.stringMatching(/^Groceries.*Oct 3, 2026 · Weekly market.*IDR 50,000\.00/),
    ])
  })

  test('more expenses than one page are loaded on request', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    for (let i = 0; i < 51; i++) addExpense(household.id, '2026-10-05', '1000', 'Groceries')
    renderApp('/expenses', { session: null })

    expect(await listedExpenses('October 2026')).toHaveLength(50)
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(async () => expect(await listedExpenses('October 2026')).toHaveLength(51))
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  test('a month without expenses says so and offers to add one', async () => {
    seedHousehold()
    renderApp('/expenses', { session: null })

    expect(await screen.findByText('No expenses in October 2026.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add an expense' })).toBeEnabled()
  })
})

describe('totals', () => {
  test('the month total and the total per category come from the summary', async () => {
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '50000', 'Groceries')
    addExpense(household.id, '2026-10-04', '25000', 'Groceries')
    addExpense(household.id, '2026-10-12', '20000', 'Transport')
    addExpense(household.id, '2026-09-30', '99000', 'Transport')
    renderApp('/expenses', { session: null })

    expect(await monthTotal()).toBe('IDR 95,000.00')
    const perCategory = await screen.findByRole('list', { name: 'Totals by category' })
    expect(
      within(perCategory)
        .getAllByRole('listitem')
        .map((item) => plain(item.textContent)),
    ).toEqual(['GroceriesIDR 75,000.00', 'TransportIDR 20,000.00'])
  })

  test('totals are shown exactly as the backend sends them', async () => {
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '1', 'Groceries')
    const groceries = fakeBackend.category(household.id, 'Groceries')
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/v1/households/:id/expense-summary`, () =>
        HttpResponse.json({
          month: '2026-10',
          total: { amount: '123456789012.35', currency: 'IDR' },
          categories: [
            {
              category_id: groceries.id,
              total: { amount: '0.30', currency: 'IDR' },
              count: 3,
            },
          ],
        }),
      ),
    )
    renderApp('/expenses', { session: null })

    expect(await monthTotal()).toBe('IDR 123,456,789,012.35')
    const perCategory = await screen.findByRole('list', { name: 'Totals by category' })
    expect(plain(perCategory.textContent)).toBe('GroceriesIDR 0.30')
  })
})

describe('category filter', () => {
  test('shows one category, is kept in the URL, and survives a month change', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '50000', 'Groceries')
    addExpense(household.id, '2026-10-12', '20000', 'Transport')
    addExpense(household.id, '2026-09-12', '30000', 'Groceries')
    const { router } = renderApp('/expenses', { session: null })
    await listedExpenses('October 2026')
    const groceries = fakeBackend.category(household.id, 'Groceries')

    await user.selectOptions(screen.getByLabelText('Filter by category'), 'Groceries')

    await waitFor(async () =>
      expect(await listedExpenses('October 2026')).toEqual([expect.stringMatching(/^Groceries/)]),
    )
    expect(search(router)).toEqual({ category: groceries.id })
    expect(await monthTotal()).toBe('IDR 70,000.00')

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(await listedExpenses('September 2026')).toEqual([expect.stringMatching(/^Groceries/)])
    expect(search(router)).toEqual({ category: groceries.id, month: '2026-09' })
  })

  test('"All categories" clears the filter', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '50000', 'Groceries')
    addExpense(household.id, '2026-10-12', '20000', 'Transport')
    const groceries = fakeBackend.category(household.id, 'Groceries')
    const { router } = renderApp(`/expenses?category=${groceries.id}`, { session: null })
    expect(await listedExpenses('October 2026')).toHaveLength(1)

    await user.selectOptions(screen.getByLabelText('Filter by category'), 'All categories')

    await waitFor(async () => expect(await listedExpenses('October 2026')).toHaveLength(2))
    expect(search(router)).toEqual({})
  })

  test('archived categories are offered, marked, and list their expenses', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '15000', 'Education')
    addExpense(household.id, '2026-10-04', '20000', 'Transport')
    fakeBackend.addCategory(household.id, 'Education', { archived: true })
    renderApp('/expenses', { session: null })
    await listedExpenses('October 2026')

    const filter = screen.getByLabelText('Filter by category')
    expect(within(filter).getByRole('option', { name: 'Education (archived)' })).toBeInTheDocument()
    await user.selectOptions(filter, 'Education (archived)')

    await waitFor(async () =>
      expect(await listedExpenses('October 2026')).toEqual([
        expect.stringMatching(/^Education.*IDR 15,000\.00/),
      ]),
    )
  })

  test('switching household keeps the month and clears the filter', async () => {
    const user = userEvent.setup()
    const { household, households } = seedHousehold({
      households: ['Rumah Bandung', 'Kos Jakarta'],
    })
    const jakarta = households[1]!
    addExpense(household.id, '2026-10-03', '50000', 'Groceries', 'Bandung market')
    addExpense(jakarta.id, '2026-10-06', '12000', 'Transport', 'Jakarta bus')
    const groceries = fakeBackend.category(household.id, 'Groceries')
    const { router } = renderApp(`/expenses?month=2026-10&category=${groceries.id}`, {
      session: null,
    })
    await listedExpenses('October 2026')

    await user.click(
      await screen.findByRole('button', { name: 'Household: Rumah Bandung. Switch household' }),
    )
    await user.click(await screen.findByRole('menuitemradio', { name: 'Kos Jakarta' }))

    await waitFor(async () =>
      expect(await listedExpenses('October 2026')).toEqual([expect.stringMatching(/Jakarta bus/)]),
    )
    expect(search(router)).toEqual({ month: '2026-10' })
    expect(screen.queryByText(/Bandung market/)).not.toBeInTheDocument()
  })
})

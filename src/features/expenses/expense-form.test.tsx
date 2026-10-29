import { screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'

import {
  addExpense,
  freezeToday,
  listedExpenses,
  monthHeading,
  monthTotal,
  seedHousehold,
} from '../../../tests/expenses'
import { captureRequests } from '../../../tests/msw/capture'
import { fakeBackend } from '../../../tests/msw/handlers'
import { renderApp } from '../../../tests/render-app'

beforeEach(() => freezeToday())

async function openAddForm(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Add expense' }))
  return screen.findByRole('dialog', { name: 'Add expense' })
}

async function openEditForm(user: UserEvent, rowLabel: string) {
  await user.click(await screen.findByRole('button', { name: rowLabel }))
  return screen.findByRole('dialog', { name: 'Edit expense' })
}

async function fill(
  user: UserEvent,
  form: HTMLElement,
  values: { amount?: string; date?: string; category?: string; note?: string },
) {
  const scope = within(form)
  if (values.amount !== undefined) {
    await user.clear(scope.getByLabelText(/^Amount/))
    if (values.amount) await user.type(scope.getByLabelText(/^Amount/), values.amount)
  }
  if (values.date !== undefined) {
    await user.clear(scope.getByLabelText('Date'))
    if (values.date) await user.type(scope.getByLabelText('Date'), values.date)
  }
  if (values.category) await user.selectOptions(scope.getByLabelText('Category'), values.category)
  if (values.note !== undefined) {
    await user.clear(scope.getByLabelText('Note (optional)'))
    if (values.note) await user.type(scope.getByLabelText('Note (optional)'), values.note)
  }
}

const save = (user: UserEvent, form: HTMLElement) =>
  user.click(within(form).getByRole('button', { name: 'Save expense' }))

const expenseWrites = () =>
  fakeBackend.calls.filter((call) => /^(POST|PATCH|DELETE) .*\/expenses/.test(call))

describe('adding an expense', () => {
  test('sends the amount as a string in the household currency and lists the expense', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    const requests = captureRequests('POST', /\/expenses$/)
    renderApp('/expenses', { session: null })
    const form = await openAddForm(user)

    expect(within(form).getByLabelText('Date')).toHaveValue('2026-10-15')
    await fill(user, form, { amount: '45,000', category: 'Groceries', note: 'Weekly market' })
    await save(user, form)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect((await requests.all()).map((r) => r.body)).toEqual([
      {
        amount: { amount: '45000', currency: 'IDR' },
        spent_on: '2026-10-15',
        category_id: fakeBackend.category(household.id, 'Groceries').id,
        note: 'Weekly market',
      },
    ])
    expect(await listedExpenses('October 2026')).toEqual([
      expect.stringMatching(/^Groceries.*Oct 15, 2026 · Weekly market.*IDR 45,000\.00/),
    ])
  })

  test('a zero amount is rejected without a request', async () => {
    const user = userEvent.setup()
    seedHousehold()
    renderApp('/expenses', { session: null })
    const form = await openAddForm(user)

    await fill(user, form, { amount: '0', category: 'Groceries' })
    await save(user, form)

    expect(within(form).getByLabelText(/^Amount/)).toHaveAccessibleDescription(
      'Amount must be greater than zero.',
    )
    expect(expenseWrites()).toEqual([])
  })

  test('a date in the future is rejected without a request', async () => {
    const user = userEvent.setup()
    seedHousehold()
    renderApp('/expenses', { session: null })
    const form = await openAddForm(user)

    await fill(user, form, { amount: '1000', date: '2026-10-16', category: 'Groceries' })
    await save(user, form)

    expect(within(form).getByLabelText('Date')).toHaveAccessibleDescription(
      'The date cannot be in the future.',
    )
    expect(expenseWrites()).toEqual([])
  })

  test('a category is required', async () => {
    const user = userEvent.setup()
    seedHousehold()
    renderApp('/expenses', { session: null })
    const form = await openAddForm(user)

    await fill(user, form, { amount: '1000' })
    await save(user, form)

    expect(within(form).getByLabelText('Category')).toHaveAccessibleDescription(
      'Choose a category.',
    )
    expect(expenseWrites()).toEqual([])
  })

  test('a note longer than 500 characters is rejected', async () => {
    const user = userEvent.setup()
    seedHousehold()
    renderApp('/expenses', { session: null })
    const form = await openAddForm(user)

    await fill(user, form, { amount: '1000', category: 'Groceries' })
    await user.click(within(form).getByLabelText('Note (optional)'))
    await user.paste('x'.repeat(501))
    await save(user, form)

    expect(within(form).getByLabelText('Note (optional)')).toHaveAccessibleDescription(
      'The note can be at most 500 characters.',
    )
    expect(expenseWrites()).toEqual([])
  })

  test('an expense for another month opens that month', async () => {
    const user = userEvent.setup()
    seedHousehold()
    const { router } = renderApp('/expenses', { session: null })
    const form = await openAddForm(user)

    await fill(user, form, { amount: '12000', date: '2026-09-28', category: 'Transport' })
    await save(user, form)

    expect(await monthHeading('September 2026')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?month=2026-09')
    expect(await listedExpenses('September 2026')).toEqual([
      expect.stringMatching(/^Transport.*Sep 28, 2026.*IDR 12,000\.00/),
    ])
  })

  test('the totals include the new expense', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '20000', 'Transport')
    renderApp('/expenses', { session: null })
    expect(await monthTotal()).toBe('IDR 20,000.00')
    const form = await openAddForm(user)

    await fill(user, form, { amount: '5000', category: 'Transport' })
    await save(user, form)

    await waitFor(async () => expect(await monthTotal()).toBe('IDR 25,000.00'))
    const perCategory = screen.getByRole('list', { name: 'Totals by category' })
    expect(perCategory).toHaveTextContent(/^TransportIDR\s25,000\.00$/)
  })

  test('a category archived meanwhile is reported on its field and the values are kept', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    renderApp('/expenses', { session: null })
    const form = await openAddForm(user)
    await fill(user, form, { amount: '30000', category: 'Education', note: 'Books' })
    fakeBackend.addCategory(household.id, 'Education', { archived: true })
    const categoryLoads = () =>
      fakeBackend.calls.filter(
        (call) => call.startsWith('GET') && call.endsWith('/expense-categories'),
      ).length
    const loadsBefore = categoryLoads()

    await save(user, form)

    expect(await within(form).findByText('This category is archived.')).toBeInTheDocument()
    expect(within(form).getByLabelText('Category')).toHaveAccessibleDescription(
      'This category is archived.',
    )
    expect(within(form).getByLabelText(/^Amount/)).toHaveValue('30000')
    expect(within(form).getByLabelText('Note (optional)')).toHaveValue('Books')
    await waitFor(() => expect(categoryLoads()).toBe(loadsBefore + 1))
    await waitFor(() =>
      expect(within(form).queryByRole('option', { name: 'Education' })).not.toBeInTheDocument(),
    )
  })
})

describe('editing an expense', () => {
  test('changing the amount updates the list and the totals', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '45000', 'Groceries')
    renderApp('/expenses', { session: null })
    const form = await openEditForm(user, 'Edit Groceries expense of Sat, Oct 3, 2026')

    expect(within(form).getByLabelText(/^Amount/)).toHaveValue('45000.00')
    await fill(user, form, { amount: '47,500' })
    await save(user, form)

    await waitFor(async () =>
      expect(await listedExpenses('October 2026')).toEqual([
        expect.stringMatching(/IDR 47,500\.00/),
      ]),
    )
    await waitFor(async () => expect(await monthTotal()).toBe('IDR 47,500.00'))
  })

  test('an archived category stays selected and the expense can be saved', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '20000', 'Laundry')
    const laundry = fakeBackend.addCategory(household.id, 'Laundry', { archived: true })
    const requests = captureRequests('PATCH', /\/expenses\//)
    renderApp('/expenses', { session: null })
    const form = await openEditForm(user, 'Edit Laundry expense of Sat, Oct 3, 2026')

    const category = within(form).getByLabelText('Category')
    expect(category).toHaveValue(laundry.id)
    expect(within(category).getByRole('option', { name: 'Laundry (archived)' })).toBeInTheDocument()
    await fill(user, form, { note: 'Ironing' })
    await save(user, form)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect((await requests.all())[0]!.body).toMatchObject({
      category_id: laundry.id,
      note: 'Ironing',
    })
    expect(await listedExpenses('October 2026')).toEqual([
      expect.stringMatching(/^Laundry.*Ironing/),
    ])
  })
})

describe('deleting an expense', () => {
  test('after confirming, the expense is gone from the list and the totals', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '45000', 'Groceries')
    addExpense(household.id, '2026-10-04', '20000', 'Transport')
    renderApp('/expenses', { session: null })
    expect(await monthTotal()).toBe('IDR 65,000.00')
    const form = await openEditForm(user, 'Edit Groceries expense of Sat, Oct 3, 2026')

    await user.click(within(form).getByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete this expense?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))

    await waitFor(async () =>
      expect(await listedExpenses('October 2026')).toEqual([expect.stringMatching(/^Transport/)]),
    )
    await waitFor(async () => expect(await monthTotal()).toBe('IDR 20,000.00'))
  })

  test('cancelling sends nothing and keeps the expense', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '45000', 'Groceries')
    renderApp('/expenses', { session: null })
    const form = await openEditForm(user, 'Edit Groceries expense of Sat, Oct 3, 2026')

    await user.click(within(form).getByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete this expense?' })
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    // The list sits behind the still-open sheet; close it to read the list.
    await user.keyboard('{Escape}')

    expect(expenseWrites()).toEqual([])
    expect(await listedExpenses('October 2026')).toHaveLength(1)
  })

  test('an expense deleted in another session is reported and the month reloads', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    const expense = addExpense(household.id, '2026-10-03', '45000', 'Groceries')
    renderApp('/expenses', { session: null })
    const form = await openEditForm(user, 'Edit Groceries expense of Sat, Oct 3, 2026')
    fakeBackend.state.expenses = fakeBackend.state.expenses.filter((e) => e.id !== expense.id)

    await fill(user, form, { amount: '50000' })
    await save(user, form)

    expect(await screen.findByText('This expense no longer exists.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('No expenses in October 2026.')).toBeInTheDocument()
  })
})

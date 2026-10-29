import { screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'

import { addExpense, freezeToday, listedExpenses, seedHousehold } from '../../../tests/expenses'
import { DEFAULT_EXPENSE_CATEGORIES } from '../../../tests/msw/fake-backend'
import { fakeBackend } from '../../../tests/msw/handlers'
import { renderApp } from '../../../tests/render-app'

beforeEach(() => freezeToday())

const pageHeading = () => screen.findByRole('heading', { level: 1, name: 'Expense categories' })

/** Waits until the categories have loaded. */
async function pageLoaded() {
  await pageHeading()
  await screen.findByRole('list', { name: 'Active categories' })
}

const names = (listName: string) =>
  within(screen.getByRole('list', { name: listName }))
    .getAllByRole('listitem')
    .map((item) => item.firstElementChild?.textContent)

/** The categories offered by the add-expense form on `/expenses`. */
async function offeredForNewExpense(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Add expense' }))
  const form = await screen.findByRole('dialog', { name: 'Add expense' })
  const options = within(within(form).getByLabelText('Category')).getAllByRole('option')
  return options
    .filter((option) => !(option as HTMLOptionElement).disabled)
    .map((o) => o.textContent)
}

const sortedDefaults = [...DEFAULT_EXPENSE_CATEGORIES].sort((a, b) => a.localeCompare(b))

describe('categories page', () => {
  test('is opened from the Expenses page and lists active and archived categories', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    fakeBackend.addCategory(household.id, 'Laundry', { archived: true })
    const { router } = renderApp('/expenses', { session: null })

    await user.click(await screen.findByRole('link', { name: 'Manage categories' }))

    expect(await pageHeading()).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/expenses/categories')
    await screen.findByRole('list', { name: 'Active categories' })
    expect(names('Active categories')).toEqual(sortedDefaults)
    expect(screen.getByRole('heading', { level: 2, name: 'Archived' })).toBeInTheDocument()
    expect(names('Archived categories')).toEqual(['Laundry'])
    expect(document.title).toBe('Expense categories · Lumior')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Expenses' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

describe('adding and renaming', () => {
  test('a new category is listed and offered for expenses', async () => {
    const user = userEvent.setup()
    seedHousehold()
    renderApp('/expenses/categories', { session: null })
    await pageLoaded()

    await user.type(screen.getByLabelText('Category name'), 'Pets')
    await user.click(screen.getByRole('button', { name: 'Add category' }))

    await waitFor(() => expect(names('Active categories')).toContain('Pets'))
    expect(screen.getByLabelText('Category name')).toHaveValue('')
    await user.click(screen.getByRole('link', { name: 'Back to expenses' }))
    expect(await offeredForNewExpense(user)).toContain('Pets')
  })

  test('a name already used is reported on the name field', async () => {
    const user = userEvent.setup()
    seedHousehold()
    renderApp('/expenses/categories', { session: null })
    await pageLoaded()

    await user.type(screen.getByLabelText('Category name'), 'groceries')
    await user.click(screen.getByRole('button', { name: 'Add category' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Category name')).toHaveAccessibleDescription(
        'A category with this name already exists',
      ),
    )
  })

  test('a blank name is reported without a request', async () => {
    const user = userEvent.setup()
    seedHousehold()
    renderApp('/expenses/categories', { session: null })
    await pageLoaded()

    await user.type(screen.getByLabelText('Category name'), '   ')
    await user.click(screen.getByRole('button', { name: 'Add category' }))

    expect(screen.getByLabelText('Category name')).toHaveAccessibleDescription('Enter a name.')
    expect(fakeBackend.calls).not.toContainEqual(expect.stringMatching(/^POST .*categories$/))
  })

  test('a renamed category shows its new name on its expenses', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '80000', 'Dining out')
    renderApp('/expenses/categories', { session: null })
    await pageLoaded()

    await user.click(await screen.findByRole('button', { name: 'Rename Dining out' }))
    const field = screen.getByLabelText('New name for Dining out')
    await user.clear(field)
    await user.type(field, 'Restaurants')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    await waitFor(() => expect(names('Active categories')).toContain('Restaurants'))
    expect(names('Active categories')).not.toContain('Dining out')
    await user.click(screen.getByRole('link', { name: 'Back to expenses' }))
    expect(await listedExpenses('October 2026')).toEqual([expect.stringMatching(/^Restaurants/)])
  })
})

describe('archiving and restoring', () => {
  test('an archived category keeps its expenses and is not offered for new ones', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    addExpense(household.id, '2026-10-03', '150000', 'Education')
    renderApp('/expenses/categories', { session: null })
    await pageLoaded()

    await user.click(await screen.findByRole('button', { name: 'Archive Education' }))

    await waitFor(() => expect(names('Archived categories')).toEqual(['Education']))
    expect(names('Active categories')).not.toContain('Education')
    await user.click(screen.getByRole('link', { name: 'Back to expenses' }))
    expect(await listedExpenses('October 2026')).toEqual([expect.stringMatching(/^Education/)])
    expect(await offeredForNewExpense(user)).not.toContain('Education')
  })

  test('a restored category is active and offered again', async () => {
    const user = userEvent.setup()
    const { household } = seedHousehold()
    fakeBackend.addCategory(household.id, 'Education', { archived: true })
    renderApp('/expenses/categories', { session: null })
    await pageLoaded()

    await user.click(await screen.findByRole('button', { name: 'Restore Education' }))

    await waitFor(() => expect(names('Active categories')).toContain('Education'))
    expect(screen.queryByRole('list', { name: 'Archived categories' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Back to expenses' }))
    expect(await offeredForNewExpense(user)).toContain('Education')
  })
})

describe('a new household', () => {
  test('offers the nine default categories for its first expense', async () => {
    const user = userEvent.setup()
    renderApp('/expenses', { session: { households: [] } })
    await screen.findByRole('heading', { level: 1, name: 'Create your household' })

    await user.type(screen.getByLabelText('Household name'), 'Kos Jakarta')
    await user.click(screen.getByRole('button', { name: 'Create household' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Expenses' })).toBeInTheDocument()
    expect(await offeredForNewExpense(user)).toEqual(sortedDefaults)
  })

  test('a household created in SGD enters and shows expenses in SGD', async () => {
    const user = userEvent.setup()
    renderApp('/expenses', { session: { households: [] } })
    await screen.findByRole('heading', { level: 1, name: 'Create your household' })

    await user.type(screen.getByLabelText('Household name'), 'Flat Singapore')
    await user.selectOptions(screen.getByLabelText('Currency'), 'SGD')
    await user.click(screen.getByRole('button', { name: 'Create household' }))

    await user.click(await screen.findByRole('button', { name: 'Add expense' }))
    const form = await screen.findByRole('dialog', { name: 'Add expense' })
    await user.type(within(form).getByLabelText('Amount (SGD)'), '12.50')
    await user.selectOptions(within(form).getByLabelText('Category'), 'Groceries')
    await user.click(within(form).getByRole('button', { name: 'Save expense' }))

    expect(await listedExpenses('October 2026')).toEqual([
      expect.stringMatching(/^Groceries.*SGD\s12\.50/),
    ])
  })
})

import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, test } from 'vitest'

import { fakeBackend } from '../../../tests/msw/handlers'
import { TEST_CONFIG, createTestQueryClient } from '../../../tests/render-app'

import { AppProviders } from '@/app/providers'

import { expenseKeys, type ExpenseCategory } from './api'
import { useCreateExpense, useUpdateCategory, useUpdateExpense } from './mutations'

function setup() {
  const user = fakeBackend.addUser({ name: 'Rina', email: 'rina@example.com' })
  const household = fakeBackend.addHousehold('Rumah Bandung', user.id)
  fakeBackend.signInAs(user.id)
  const queryClient = createTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders config={TEST_CONFIG} queryClient={queryClient}>
      {children}
    </AppProviders>
  )
  const groceries = fakeBackend.category(household.id, 'Groceries')
  return { household, queryClient, wrapper, groceries }
}

/** Renders a mutation hook once the session has been restored. */
async function renderMutation<T>(
  hook: () => T,
  wrapper: (props: { children: ReactNode }) => ReactNode,
) {
  const rendered = renderHook(hook, { wrapper })
  await waitFor(() => expect(rendered.result.current).toBeTruthy())
  return rendered
}

const isInvalidated = (queryClient: ReturnType<typeof createTestQueryClient>, key: unknown[]) =>
  queryClient.getQueryCache().find({ queryKey: key })?.state.isInvalidated

describe('expense mutations', () => {
  test('creating an expense invalidates the lists and the summaries', async () => {
    const { household, queryClient, wrapper, groceries } = setup()
    const listKey = expenseKeys.list(household.id, '2026-10', null)
    const summaryKey = expenseKeys.summary(household.id, '2026-10')
    queryClient.setQueryData(listKey, { pages: [], pageParams: [] })
    queryClient.setQueryData(summaryKey, {})
    const { result } = await renderMutation(() => useCreateExpense(household.id), wrapper)

    await act(() =>
      result.current.mutateAsync({
        amount: { amount: '45000', currency: 'IDR' },
        spent_on: '2026-10-03',
        category_id: groceries.id,
      }),
    )

    expect(isInvalidated(queryClient, listKey)).toBe(true)
    expect(isInvalidated(queryClient, summaryKey)).toBe(true)
  })

  test('category_archived reloads the categories', async () => {
    const { household, queryClient, wrapper } = setup()
    const laundry = fakeBackend.addCategory(household.id, 'Laundry', { archived: true })
    queryClient.setQueryData(expenseKeys.categories(household.id), [])
    const { result } = await renderMutation(() => useCreateExpense(household.id), wrapper)

    act(() =>
      result.current.mutate({
        amount: { amount: '1000', currency: 'IDR' },
        spent_on: '2026-10-03',
        category_id: laundry.id,
      }),
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(isInvalidated(queryClient, expenseKeys.categories(household.id))).toBe(true)
  })

  test('expense_not_found reloads the lists', async () => {
    const { household, queryClient, wrapper, groceries } = setup()
    const listKey = expenseKeys.list(household.id, '2026-10', null)
    queryClient.setQueryData(listKey, { pages: [], pageParams: [] })
    const { result } = await renderMutation(() => useUpdateExpense(household.id), wrapper)

    act(() =>
      result.current.mutate({
        expenseId: 'exp-999',
        body: {
          amount: { amount: '1000', currency: 'IDR' },
          spent_on: '2026-10-03',
          category_id: groceries.id,
        },
      }),
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(isInvalidated(queryClient, listKey)).toBe(true)
  })

  test('renaming a category updates the cached list without a refetch', async () => {
    const { household, queryClient, wrapper } = setup()
    const categoriesKey = expenseKeys.categories(household.id)
    const dining = fakeBackend.category(household.id, 'Dining out')
    const other = fakeBackend.category(household.id, 'Other')
    queryClient.setQueryData<ExpenseCategory[]>(categoriesKey, [
      { id: dining.id, name: 'Dining out', archived: false },
      { id: other.id, name: 'Other', archived: false },
    ])
    const { result } = await renderMutation(() => useUpdateCategory(household.id), wrapper)
    const listCalls = () =>
      fakeBackend.calls.filter(
        (call) => call.startsWith('GET') && call.endsWith('expense-categories'),
      )

    await act(() =>
      result.current.mutateAsync({ categoryId: dining.id, changes: { name: 'Restaurants' } }),
    )

    expect(queryClient.getQueryData(categoriesKey)).toEqual([
      { id: other.id, name: 'Other', archived: false },
      { id: dining.id, name: 'Restaurants', archived: false },
    ])
    expect(isInvalidated(queryClient, categoriesKey)).toBe(false)
    expect(listCalls()).toHaveLength(0)
  })
})

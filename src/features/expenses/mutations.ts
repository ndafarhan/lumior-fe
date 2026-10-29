import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { useApi } from '@/lib/api/context'
import { isApiError } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'

import { expenseKeys, type ExpenseCategory } from './api'

export type ExpenseInput = components['schemas']['CreateExpenseRequest']

/**
 * After any expense change: every list and summary of the household may be affected (an edit
 * can move an expense to another month). Errors that mean our view is out of date also reload.
 */
function invalidateExpenses(queryClient: QueryClient, householdId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: expenseKeys.lists(householdId) }),
    queryClient.invalidateQueries({ queryKey: expenseKeys.summaries(householdId) }),
  ])
}

function reloadAfterError(queryClient: QueryClient, householdId: string, error: unknown) {
  if (!isApiError(error)) return
  if (error.code === 'category_archived' || error.code === 'category_not_found') {
    void queryClient.invalidateQueries({ queryKey: expenseKeys.categories(householdId) })
  }
  if (error.code === 'expense_not_found') void invalidateExpenses(queryClient, householdId)
}

export function useCreateExpense(householdId: string) {
  const { client } = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: ExpenseInput) =>
      (
        await client.POST('/api/v1/households/{household_id}/expenses', {
          params: { path: { household_id: householdId } },
          body,
        })
      ).data!,
    onSuccess: () => invalidateExpenses(queryClient, householdId),
    onError: (error) => reloadAfterError(queryClient, householdId, error),
  })
}

export function useUpdateExpense(householdId: string) {
  const { client } = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ expenseId, body }: { expenseId: string; body: ExpenseInput }) =>
      (
        await client.PATCH('/api/v1/households/{household_id}/expenses/{expense_id}', {
          params: { path: { household_id: householdId, expense_id: expenseId } },
          body,
        })
      ).data!,
    onSuccess: () => invalidateExpenses(queryClient, householdId),
    onError: (error) => reloadAfterError(queryClient, householdId, error),
  })
}

export function useDeleteExpense(householdId: string) {
  const { client } = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (expenseId: string) => {
      await client.DELETE('/api/v1/households/{household_id}/expenses/{expense_id}', {
        params: { path: { household_id: householdId, expense_id: expenseId } },
      })
    },
    onSuccess: () => invalidateExpenses(queryClient, householdId),
    onError: (error) => reloadAfterError(queryClient, householdId, error),
  })
}

/** Puts a created or changed category into the cached list, keeping it ordered by name. */
function storeCategory(queryClient: QueryClient, householdId: string, saved: ExpenseCategory) {
  queryClient.setQueryData<ExpenseCategory[]>(expenseKeys.categories(householdId), (list = []) =>
    [...list.filter((category) => category.id !== saved.id), saved].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    ),
  )
}

export function useCreateCategory(householdId: string) {
  const { client } = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) =>
      (
        await client.POST('/api/v1/households/{household_id}/expense-categories', {
          params: { path: { household_id: householdId } },
          body: { name },
        })
      ).data!,
    onSuccess: (created) => storeCategory(queryClient, householdId, created),
  })
}

/** Renames, archives, or restores a category. */
export function useUpdateCategory(householdId: string) {
  const { client } = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      categoryId,
      changes,
    }: {
      categoryId: string
      changes: { name?: string; archived?: boolean }
    }) =>
      (
        await client.PATCH('/api/v1/households/{household_id}/expense-categories/{category_id}', {
          params: { path: { household_id: householdId, category_id: categoryId } },
          body: changes,
        })
      ).data!,
    onSuccess: (updated) => storeCategory(queryClient, householdId, updated),
  })
}

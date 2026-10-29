import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { useApi } from '@/lib/api/context'
import { householdKey } from '@/lib/api/query-keys'
import type { components } from '@/lib/api/schema'

export type Household = components['schemas']['Household']
export type Expense = components['schemas']['Expense']
export type ExpenseCategory = components['schemas']['ExpenseCategory']
export type ExpenseSummary = components['schemas']['ExpenseSummary']
export type Money = components['schemas']['Money']

/** Query keys, all below the household prefix so a household switch drops them. */
export const expenseKeys = {
  categories: (householdId: string) => [...householdKey(householdId), 'expense-categories'],
  /** Every expense list of the household, whatever the month or filter. */
  lists: (householdId: string) => [...householdKey(householdId), 'expenses'],
  list: (householdId: string, month: string, categoryId: string | null) => [
    ...expenseKeys.lists(householdId),
    month,
    categoryId,
  ],
  /** Every month summary of the household. */
  summaries: (householdId: string) => [...householdKey(householdId), 'expense-summary'],
  summary: (householdId: string, month: string) => [...expenseKeys.summaries(householdId), month],
}

/** The household's categories, active and archived, ordered by name. */
export function useExpenseCategoriesQuery(householdId: string) {
  const { client } = useApi()
  return useQuery({
    queryKey: expenseKeys.categories(householdId),
    queryFn: async ({ signal }) =>
      (
        await client.GET('/api/v1/households/{household_id}/expense-categories', {
          params: { path: { household_id: householdId } },
          signal,
        })
      ).data!,
  })
}

/** A month's expenses, newest first, one page at a time. */
export function useExpensesInfiniteQuery(
  householdId: string,
  month: string,
  categoryId: string | null,
) {
  const { client } = useApi()
  return useInfiniteQuery({
    queryKey: expenseKeys.list(householdId, month, categoryId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) =>
      (
        await client.GET('/api/v1/households/{household_id}/expenses', {
          params: {
            path: { household_id: householdId },
            query: {
              month,
              ...(categoryId ? { category_id: categoryId } : {}),
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          },
          signal,
        })
      ).data!,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  })
}

/** The month's total and per-category totals, as calculated by the backend. */
export function useExpenseSummaryQuery(householdId: string, month: string) {
  const { client } = useApi()
  return useQuery({
    queryKey: expenseKeys.summary(householdId, month),
    queryFn: async ({ signal }) =>
      (
        await client.GET('/api/v1/households/{household_id}/expense-summary', {
          params: { path: { household_id: householdId }, query: { month } },
          signal,
        })
      ).data!,
  })
}

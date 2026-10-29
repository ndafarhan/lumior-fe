import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { RouteObject } from 'react-router'
import { describe, expect, test } from 'vitest'

import { captureRequests } from '../../../tests/msw/capture'
import { fakeBackend } from '../../../tests/msw/handlers'
import { renderApp } from '../../../tests/render-app'

import { RequireHousehold, RequireSession, RootRoute } from '@/app/guards'
import { useActiveHousehold, useHouseholds } from '@/features/households/context'

import { expenseKeys, useExpensesInfiniteQuery, useExpenseSummaryQuery } from './api'

/** Loads expenses for the active household and offers paging, filtering, and switching. */
function Probe() {
  const household = useActiveHousehold()
  const { households, setActive } = useHouseholds()
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const expenses = useExpensesInfiniteQuery(household.id, '2026-10', categoryId)
  const summary = useExpenseSummaryQuery(household.id, '2026-10')
  const items = expenses.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <>
      <h1>{household.name}</h1>
      <p>Loaded {items.length}</p>
      <p>Total {summary.data?.total.amount}</p>
      {expenses.hasNextPage && (
        <button type="button" onClick={() => void expenses.fetchNextPage()}>
          More
        </button>
      )}
      <button type="button" onClick={() => setCategoryId(items[0]?.category_id ?? null)}>
        Filter
      </button>
      {households.map((h) => (
        <button key={h.id} type="button" onClick={() => setActive(h.id)}>
          Switch to {h.name}
        </button>
      ))}
    </>
  )
}

const routes: RouteObject[] = [
  {
    element: <RootRoute />,
    children: [
      {
        element: <RequireSession />,
        children: [
          { element: <RequireHousehold />, children: [{ index: true, element: <Probe /> }] },
        ],
      },
    ],
  },
]

describe('expense queries', () => {
  test('the list sends month, category_id, and cursor', async () => {
    const user = userEvent.setup()
    const requests = captureRequests('GET', /\/expenses$/)
    const { seeded } = renderApp('/', {
      routes,
      session: { households: ['Rumah Bandung'] },
    })
    const household = seeded!.households[0]!
    for (let day = 1; day <= 51; day++) {
      fakeBackend.addExpense(household.id, {
        amount: '1000',
        spentOn: `2026-10-${String(Math.min(day, 28)).padStart(2, '0')}`,
        category: day === 51 ? 'Transport' : 'Groceries',
      })
    }

    expect(await screen.findByText('Loaded 50')).toBeInTheDocument()
    expect(screen.getByText('Total 51000.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More' }))
    expect(await screen.findByText('Loaded 51')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await waitFor(async () => expect(await requests.all()).toHaveLength(3))

    const queries = (await requests.all()).map((r) => Object.fromEntries(r.url.searchParams))
    const transport = fakeBackend.category(household.id, 'Transport').id
    expect(queries).toEqual([
      { month: '2026-10' },
      { month: '2026-10', cursor: '50' },
      { month: '2026-10', category_id: transport },
    ])
  })

  test("switching households removes the previous household's expense queries", async () => {
    const user = userEvent.setup()
    const { seeded, queryClient } = renderApp('/', {
      routes,
      session: { households: ['Rumah Bandung', 'Kos Jakarta'] },
    })
    const [bandung] = seeded!.households
    await screen.findByText('Total 0.00')
    expect(
      queryClient.getQueryCache().findAll({ queryKey: expenseKeys.lists(bandung!.id) }),
    ).not.toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Switch to Kos Jakarta' }))

    expect(await screen.findByRole('heading', { name: 'Kos Jakarta' })).toBeInTheDocument()
    expect(
      queryClient.getQueryCache().findAll({ queryKey: expenseKeys.lists(bandung!.id) }),
    ).toHaveLength(0)
    expect(
      queryClient.getQueryCache().findAll({ queryKey: expenseKeys.summaries(bandung!.id) }),
    ).toHaveLength(0)
  })
})

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { isApiError } from '@/lib/api/errors'
import { useCurrentUser } from '@/lib/auth/use-session'

import { readActiveHouseholdId, writeActiveHouseholdId } from './active-household-storage'
import { HOUSEHOLDS_KEY, householdKey, useHouseholdsQuery, type Household } from './api'
import { HouseholdContext, type HouseholdContextValue } from './context'

/** Error codes meaning the user can no longer use a household (removed, or it is gone). */
const ACCESS_LOST_CODES = new Set(['not_a_member', 'household_not_found'])

const isAccessLost = (error: unknown) => isApiError(error) && ACCESS_LOST_CODES.has(error.code)

/**
 * Loads the signed-in user's households and keeps one active: the one chosen last on this
 * device, or the first in the list when that one is gone. When any request reports that the
 * user lost access to a household, the list is reloaded and the user is told.
 */
export function HouseholdProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const query = useHouseholdsQuery()
  const [chosenId, setChosenId] = useState(() => readActiveHouseholdId(user.id))
  const [notice, setNotice] = useState<string | null>(null)

  const households = useMemo(() => query.data ?? [], [query.data])
  const active = households.find((household) => household.id === chosenId) ?? households[0] ?? null

  const setActive = useCallback(
    (householdId: string) => {
      if (active && active.id !== householdId) {
        queryClient.removeQueries({ queryKey: householdKey(active.id) })
      }
      writeActiveHouseholdId(user.id, householdId)
      setChosenId(householdId)
    },
    [active, queryClient, user.id],
  )

  // The cache listeners below outlive renders, so they read the latest list through a ref.
  const householdsRef = useRef<Household[]>(households)
  useEffect(() => {
    householdsRef.current = households
  }, [households])

  useEffect(() => {
    let checking = false

    async function handleAccessLost() {
      if (checking) return
      checking = true
      try {
        const before = householdsRef.current
        const after = (await queryClient.fetchQuery({ queryKey: HOUSEHOLDS_KEY, staleTime: 0 })) as
          Household[] | undefined
        const remaining = new Set((after ?? []).map((household) => household.id))
        const lost = before.filter((household) => !remaining.has(household.id))
        for (const household of lost) {
          queryClient.removeQueries({ queryKey: householdKey(household.id) })
        }
        if (lost.length > 0) {
          setNotice(`You no longer have access to ${lost.map((h) => h.name).join(', ')}.`)
        }
      } catch {
        // The list query reports its own error.
      } finally {
        checking = false
      }
    }

    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.action.type === 'error' &&
        isAccessLost(event.action.error)
      ) {
        void handleAccessLost()
      }
    })
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.action.type === 'error' &&
        isAccessLost(event.action.error)
      ) {
        void handleAccessLost()
      }
    })
    return () => {
      unsubscribeQueries()
      unsubscribeMutations()
    }
  }, [queryClient])

  const value = useMemo<HouseholdContextValue>(
    () => ({
      status: query.isPending ? 'loading' : query.isError && !query.data ? 'error' : 'ready',
      error: query.error,
      households,
      active,
      setActive,
      reload: query.refetch,
      notice,
      dismissNotice: () => setNotice(null),
    }),
    [
      query.isPending,
      query.isError,
      query.data,
      query.error,
      query.refetch,
      households,
      active,
      setActive,
      notice,
    ],
  )

  return <HouseholdContext value={value}>{children}</HouseholdContext>
}

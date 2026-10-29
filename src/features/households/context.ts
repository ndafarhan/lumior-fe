import { createContext, useContext } from 'react'

import type { Household } from './api'

export type HouseholdContextValue = {
  /** `loading` until the list arrives; `error` if it could not be loaded. */
  status: 'loading' | 'error' | 'ready'
  error: unknown
  households: Household[]
  /** The household the user is working in, or `null` when they belong to none. */
  active: Household | null
  /** Makes another household active and drops the previous one's cached data. */
  setActive: (householdId: string) => void
  /** Reloads the list, for example after joining or leaving a household. */
  reload: () => Promise<unknown>
  /** A message for the user, for example after losing access to a household. */
  notice: string | null
  dismissNotice: () => void
}

export const HouseholdContext = createContext<HouseholdContextValue | null>(null)

export function useHouseholds(): HouseholdContextValue {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHouseholds must be used inside <HouseholdProvider>')
  return value
}

/** The active household. Only use below a route that requires one. */
export function useActiveHousehold(): Household {
  const { active } = useHouseholds()
  if (!active) throw new Error('useActiveHousehold requires an active household')
  return active
}

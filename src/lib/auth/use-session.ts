import { useSyncExternalStore } from 'react'

import { useApi } from '@/lib/api/context'

import type { SessionState, SessionUser } from './session'

/** The current session state; re-renders when the user signs in, out, or changes profile. */
export function useSessionState(): SessionState {
  const { session } = useApi()
  return useSyncExternalStore(session.subscribe, session.getState)
}

/** The signed-in user. Only use below a route that requires a session. */
export function useCurrentUser(): SessionUser {
  const state = useSessionState()
  if (state.status !== 'signed-in') throw new Error('useCurrentUser requires a signed-in user')
  return state.user
}

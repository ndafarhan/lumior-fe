import { createContext, useContext } from 'react'

import type { SessionStore } from '@/lib/auth/session'
import type { AppConfig } from '@/lib/config'

import type { ApiClient } from './client'

export type ApiContextValue = {
  /** Sends the access token and refreshes it on 401. */
  client: ApiClient
  config: AppConfig
  session: SessionStore
}

export const ApiContext = createContext<ApiContextValue | null>(null)

/** The typed API client, the validated app configuration, and the session store. */
export function useApi(): ApiContextValue {
  const value = useContext(ApiContext)
  if (!value) throw new Error('useApi must be used inside <AppProviders>')
  return value
}

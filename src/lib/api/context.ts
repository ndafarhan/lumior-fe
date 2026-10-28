import { createContext, useContext } from 'react'

import type { AppConfig } from '@/lib/config'

import type { ApiClient } from './client'

export type ApiContextValue = {
  client: ApiClient
  config: AppConfig
}

export const ApiContext = createContext<ApiContextValue | null>(null)

/** The typed API client and the validated app configuration. */
export function useApi(): ApiContextValue {
  const value = useContext(ApiContext)
  if (!value) throw new Error('useApi must be used inside <AppProviders>')
  return value
}

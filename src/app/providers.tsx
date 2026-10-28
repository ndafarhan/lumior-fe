import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

import { createApiClient } from '@/lib/api/client'
import { ApiContext, type ApiContextValue } from '@/lib/api/context'
import { createQueryClient } from '@/lib/api/query-client'
import type { AppConfig } from '@/lib/config'

type AppProvidersProps = {
  config: AppConfig
  /** Tests pass their own client to control retries and caching. */
  queryClient?: QueryClient
  children: ReactNode
}

export function AppProviders({ config, queryClient, children }: AppProvidersProps) {
  const [api] = useState<ApiContextValue>(() => ({
    client: createApiClient(config.apiBaseUrl),
    config,
  }))
  const [defaultQueryClient] = useState(createQueryClient)

  return (
    <ApiContext value={api}>
      <QueryClientProvider client={queryClient ?? defaultQueryClient}>
        {children}
      </QueryClientProvider>
    </ApiContext>
  )
}

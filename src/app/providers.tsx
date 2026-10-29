import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

import { SessionGate } from '@/features/auth/SessionGate'
import { createApiClient } from '@/lib/api/client'
import { ApiContext, type ApiContextValue } from '@/lib/api/context'
import { createQueryClient } from '@/lib/api/query-client'
import { createSessionStore } from '@/lib/auth/session'
import type { AppConfig } from '@/lib/config'

type AppProvidersProps = {
  config: AppConfig
  /** Tests pass their own client to control retries and caching. */
  queryClient?: QueryClient
  children: ReactNode
}

function createApi(config: AppConfig): ApiContextValue {
  // Auth endpoints use a client without the token so a 401 there never triggers a refresh.
  const publicClient = createApiClient(config.apiBaseUrl)
  const session = createSessionStore({
    refresh: async () => (await publicClient.POST('/api/v1/auth/refresh')).data!,
  })
  return { client: createApiClient(config.apiBaseUrl, session), config, session }
}

export function AppProviders({ config, queryClient, children }: AppProvidersProps) {
  const [api] = useState(() => createApi(config))
  const [defaultQueryClient] = useState(createQueryClient)

  return (
    <ApiContext value={api}>
      <QueryClientProvider client={queryClient ?? defaultQueryClient}>
        <SessionGate>{children}</SessionGate>
      </QueryClientProvider>
    </ApiContext>
  )
}

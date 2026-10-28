import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router'

import { AppProviders } from '@/app/providers'
import { appRoutes } from '@/app/routes'
import type { AppConfig } from '@/lib/config'

import { TEST_API_BASE_URL } from './constants'

export const TEST_CONFIG: AppConfig = { apiBaseUrl: TEST_API_BASE_URL }

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
}

/** Renders the app (or the given routes) at `path` with a memory router and test providers. */
export function renderApp(path = '/', routes: RouteObject[] = appRoutes) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = createTestQueryClient()
  const result = render(
    <AppProviders config={TEST_CONFIG} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...result, router, queryClient }
}

import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router'

import { AppProviders } from '@/app/providers'
import { appRoutes } from '@/app/routes'
import type { AppConfig } from '@/lib/config'

import { TEST_API_BASE_URL } from './constants'
import { fakeBackend } from './msw/handlers'

export const TEST_CONFIG: AppConfig = { apiBaseUrl: TEST_API_BASE_URL }

export const TEST_USER = { name: 'Rina', email: 'rina@example.com', password: 'password123' }

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
}

export type SeedSession = {
  /** Households the user owns, oldest first. */
  households?: string[]
  /** `false` creates the account without a session, so the test signs in itself. */
  signedIn?: boolean
}

/** Creates `TEST_USER` with the given households and, by default, a valid browser session. */
export function seedSession({ households = ['Rumah Bandung'], signedIn = true }: SeedSession = {}) {
  const user = fakeBackend.addUser(TEST_USER)
  const owned = households.map((name) => fakeBackend.addHousehold(name, user.id))
  if (signedIn) fakeBackend.signInAs(user.id)
  return { user, households: owned }
}

type RenderAppOptions = {
  /** Routes to render instead of the app's. */
  routes?: RouteObject[]
  /** Who is signed in when the app loads. `null` starts signed out. */
  session?: SeedSession | null
}

/**
 * Renders the app (or the given routes) at `path` with a memory router and test providers.
 * By default `TEST_USER` is signed in and owns one household, "Rumah Bandung".
 */
export function renderApp(path = '/', { routes = appRoutes, session = {} }: RenderAppOptions = {}) {
  const seeded = session === null ? null : seedSession(session)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = createTestQueryClient()
  const result = render(
    <AppProviders config={TEST_CONFIG} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...result, router, queryClient, seeded }
}

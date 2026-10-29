import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'

import { FullPageLoader } from '@/components/FullPageLoader'
import { Button } from '@/components/ui/button'
import { loginPath, safeReturnPath } from '@/features/auth/return-to'
import { useHouseholds } from '@/features/households/context'
import { HouseholdProvider } from '@/features/households/HouseholdProvider'
import { userMessageFor } from '@/lib/api/messages'
import { useSessionState } from '@/lib/auth/use-session'

import { useDocumentTitle } from './useDocumentTitle'

/** The root route: keeps the document title in sync for every page. */
export function RootRoute() {
  useDocumentTitle()
  return <Outlet />
}

/** Sign-in and registration: a signed-in user goes to `next` (or the dashboard) instead. */
export function PublicOnlyRoute() {
  const state = useSessionState()
  const [searchParams] = useSearchParams()
  if (state.status === 'signed-in') {
    return <Navigate to={safeReturnPath(searchParams.get('next'))} replace />
  }
  return <Outlet />
}

/**
 * Everything else: a signed-out visitor is sent to sign in and brought back afterwards.
 * Signed-in pages get the user's households.
 */
export function RequireSession() {
  const state = useSessionState()
  const location = useLocation()
  if (state.status === 'signed-out') {
    // After an explicit sign-out, start fresh at the dashboard next time.
    const here = `${location.pathname}${location.search}`
    const keepPlace = state.reason === 'initial' || state.reason === 'expired'
    const reason = state.reason === 'expired' ? 'expired' : undefined
    return <Navigate to={loginPath(keepPlace ? here : undefined, reason)} replace />
  }
  return (
    // Keyed by user so another user's household choice never carries over.
    <HouseholdProvider key={state.user.id}>
      <Outlet />
    </HouseholdProvider>
  )
}

/** App areas: the user needs an active household; without one they are onboarded first. */
export function RequireHousehold() {
  const { status, error, active, reload } = useHouseholds()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'error') {
    return (
      <main className="mx-auto grid min-h-svh max-w-md content-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Your households could not be loaded</h1>
        <p className="text-muted-foreground">{userMessageFor(error)}</p>
        <Button className="justify-self-center" onClick={() => void reload()}>
          Try again
        </Button>
      </main>
    )
  }
  if (!active) {
    const here = `${location.pathname}${location.search}`
    const query = here === '/' ? '' : `?next=${encodeURIComponent(here)}`
    return <Navigate to={`/welcome${query}`} replace />
  }
  return <Outlet />
}

import { useQueryClient } from '@tanstack/react-query'
import { WifiOff } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { FullPageLoader } from '@/components/FullPageLoader'
import { Button } from '@/components/ui/button'
import { useApi } from '@/lib/api/context'
import { isApiError } from '@/lib/api/errors'
import { userMessageFor } from '@/lib/api/messages'

type Startup = { status: 'loading' } | { status: 'ready' } | { status: 'failed'; error: unknown }

/**
 * Restores the session from the refresh cookie before rendering the app, follows sign-outs in
 * other tabs, and clears cached data whenever the user signs out.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { session } = useApi()
  const queryClient = useQueryClient()
  const [startup, setStartup] = useState<Startup>({ status: 'loading' })

  const restore = useCallback(() => {
    session.refresh().then(
      () => setStartup({ status: 'ready' }),
      (error: unknown) => {
        // 401 just means nobody is signed in.
        if (isApiError(error) && error.status === 401) setStartup({ status: 'ready' })
        else setStartup({ status: 'failed', error })
      },
    )
  }, [session])

  useEffect(restore, [restore])

  function retry() {
    setStartup({ status: 'loading' })
    restore()
  }
  useEffect(() => session.listenToOtherTabs(), [session])
  useEffect(
    () =>
      session.subscribe(() => {
        if (session.getState().status === 'signed-out') queryClient.clear()
      }),
    [session, queryClient],
  )

  if (startup.status === 'loading') return <FullPageLoader />

  if (startup.status === 'failed') {
    return (
      <main className="mx-auto grid min-h-svh max-w-md content-center gap-4 p-6 text-center">
        <WifiOff className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Cannot reach the server</h1>
        <p className="text-muted-foreground">{userMessageFor(startup.error)}</p>
        <Button className="justify-self-center" onClick={retry}>
          Try again
        </Button>
      </main>
    )
  }

  return children
}

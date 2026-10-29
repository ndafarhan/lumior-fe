import { useCallback } from 'react'

import { useApi } from '@/lib/api/context'

/**
 * Signs out right away in this tab (and the app's other tabs), then asks the backend to end the
 * session. The local sign-out does not wait for, or depend on, that request.
 */
export function useSignOut(): () => void {
  const { client, session } = useApi()
  return useCallback(() => {
    session.signOut()
    client.POST('/api/v1/auth/logout').catch(() => {
      // The refresh cookie expires on its own; nothing else to do offline.
    })
  }, [client, session])
}

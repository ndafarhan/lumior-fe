import { isApiError } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'

export type SessionPayload = components['schemas']['Session']
export type SessionUser = components['schemas']['User']

/** Why the user is signed out. `initial` means no session was found when the app loaded. */
export type SignedOutReason = 'initial' | 'signed-out' | 'expired' | 'other-tab'

export type SessionState =
  { status: 'signed-in'; user: SessionUser } | { status: 'signed-out'; reason: SignedOutReason }

export const SESSION_CHANNEL = 'lumior-session'
const SIGNED_OUT_MESSAGE = 'signed-out'

type SessionStoreOptions = {
  /** Calls `POST /api/v1/auth/refresh`. Throws `ApiError` on failure. */
  refresh: () => Promise<SessionPayload>
  /** BroadcastChannel name used to sign out other tabs. Tests pass their own. */
  channelName?: string
}

/**
 * Holds the signed-in user and the access token in memory only. The refresh token stays in the
 * backend's httpOnly cookie. Concurrent `refresh()` calls share one request, and signing out is
 * broadcast to the app's other tabs.
 */
export function createSessionStore({
  refresh,
  channelName = SESSION_CHANNEL,
}: SessionStoreOptions) {
  let state: SessionState = { status: 'signed-out', reason: 'initial' }
  let accessToken: string | null = null
  let pendingRefresh: Promise<string> | null = null
  const listeners = new Set<() => void>()

  function setState(next: SessionState) {
    state = next
    listeners.forEach((listener) => listener())
  }

  function endSession(reason: Exclude<SignedOutReason, 'initial'>) {
    accessToken = null
    setState({ status: 'signed-out', reason })
  }

  function signIn(session: SessionPayload) {
    accessToken = session.access_token
    setState({ status: 'signed-in', user: session.user })
  }

  async function runRefresh(): Promise<string> {
    try {
      const session = await refresh()
      signIn(session)
      return session.access_token
    } catch (error) {
      // Only a rejected cookie ends the session; network failures and timeouts do not.
      if (isApiError(error) && error.status === 401 && state.status === 'signed-in') {
        endSession('expired')
      }
      throw error
    }
  }

  return {
    getState: (): SessionState => state,
    getAccessToken: (): string | null => accessToken,

    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    signIn,

    /** Replaces the signed-in user's profile, for example after a name change. */
    updateUser(user: SessionUser) {
      if (state.status === 'signed-in') setState({ status: 'signed-in', user })
    },

    /** Gets a new access token from the refresh cookie. Concurrent callers share one request. */
    refresh(): Promise<string> {
      pendingRefresh ??= runRefresh().finally(() => {
        pendingRefresh = null
      })
      return pendingRefresh
    },

    /** Ends the session locally and tells the app's other tabs to do the same. */
    signOut(reason: 'signed-out' | 'expired' = 'signed-out') {
      endSession(reason)
      if (typeof BroadcastChannel === 'undefined') return
      const channel = new BroadcastChannel(channelName)
      channel.postMessage(SIGNED_OUT_MESSAGE)
      channel.close()
    },

    /**
     * Signs this tab out when another tab signs out. Returns a function that stops listening.
     * Call it from an effect, so StrictMode's double mount does not leave a channel open.
     */
    listenToOtherTabs(): () => void {
      if (typeof BroadcastChannel === 'undefined') return () => {}
      const channel = new BroadcastChannel(channelName)
      channel.addEventListener('message', (event: MessageEvent) => {
        if (event.data === SIGNED_OUT_MESSAGE && state.status === 'signed-in') {
          endSession('other-tab')
        }
      })
      return () => channel.close()
    },
  }
}

export type SessionStore = ReturnType<typeof createSessionStore>

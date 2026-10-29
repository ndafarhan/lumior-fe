import createClient from 'openapi-fetch'

import { ApiError, REQUEST_ID_HEADER, apiErrorFromResponse, isApiError } from './errors'
import type { paths } from './schema'

export const REQUEST_TIMEOUT_MS = 15_000

/**
 * `fetch` for every backend call: adds a request ID, sends credentials, aborts after
 * `REQUEST_TIMEOUT_MS`, and throws `ApiError` for network failures, timeouts, and non-2xx
 * responses. A caller's own abort is rethrown unchanged so query cancellation keeps working.
 */
export async function apiFetch(input: Request): Promise<Response> {
  const requestId = crypto.randomUUID()
  const headers = new Headers(input.headers)
  headers.set(REQUEST_ID_HEADER, requestId)

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS)
  const request = new Request(input, {
    headers,
    credentials: 'include',
    signal: AbortSignal.any([input.signal, timeout.signal]),
  })

  let response: Response
  try {
    response = await fetch(request)
  } catch (error) {
    if (timeout.signal.aborted) throw ApiError.timeout({ requestId, method: request.method }, error)
    if (input.signal.aborted) throw error
    throw ApiError.network({ requestId, method: request.method }, error)
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) throw await apiErrorFromResponse(response, request.method)
  return response
}

/** Where authenticated requests get their access token. Implemented by the session store. */
export type AccessTokenSource = {
  getAccessToken(): string | null
  /** Resolves with a new access token, or throws if the session cannot be refreshed. */
  refresh(): Promise<string>
}

// Sign-in, registration, refresh, and sign-out never carry or refresh an access token.
const AUTH_PATH = '/api/v1/auth/'

/**
 * `apiFetch` plus authentication: adds `Authorization: Bearer` while signed in, and when such a
 * request gets 401, refreshes the token once and sends the request once more (writes too, since
 * the backend rejected the original before doing anything). If the refresh fails, the original
 * 401 `ApiError` is thrown.
 */
export function createAuthenticatedFetch(auth: AccessTokenSource) {
  return async function authenticatedFetch(input: Request): Promise<Response> {
    const token = new URL(input.url).pathname.startsWith(AUTH_PATH) ? null : auth.getAccessToken()
    if (!token) return apiFetch(input)

    // Keep an unread copy so the body can be sent again after a refresh.
    const resend = input.clone()
    input.headers.set('Authorization', `Bearer ${token}`)
    try {
      return await apiFetch(input)
    } catch (error) {
      if (!isApiError(error) || error.status !== 401) throw error

      let freshToken = auth.getAccessToken()
      // Another request may already have refreshed while this one was in flight.
      if (!freshToken || freshToken === token) {
        try {
          freshToken = await auth.refresh()
        } catch {
          throw error
        }
      }
      resend.headers.set('Authorization', `Bearer ${freshToken}`)
      return apiFetch(resend)
    }
  }
}

/**
 * Typed client for the backend. OpenAPI paths already start with `/api/v1`, so the base URL
 * is the backend origin. Calls resolve with `{ data }` on success and throw `ApiError`
 * otherwise, so callers never inspect `error` on the result. With `auth`, requests are
 * authenticated as described in `createAuthenticatedFetch`.
 */
export function createApiClient(apiBaseUrl: string, auth?: AccessTokenSource) {
  return createClient<paths>({
    baseUrl: apiBaseUrl,
    fetch: auth ? createAuthenticatedFetch(auth) : apiFetch,
  })
}

export type ApiClient = ReturnType<typeof createApiClient>

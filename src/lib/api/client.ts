import createClient from 'openapi-fetch'

import { ApiError, REQUEST_ID_HEADER, apiErrorFromResponse } from './errors'
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

/**
 * Typed client for the backend. OpenAPI paths already start with `/api/v1`, so the base URL
 * is the backend origin. Calls resolve with `{ data }` on success and throw `ApiError`
 * otherwise, so callers never inspect `error` on the result.
 */
export function createApiClient(apiBaseUrl: string) {
  return createClient<paths>({ baseUrl: apiBaseUrl, fetch: apiFetch })
}

export type ApiClient = ReturnType<typeof createApiClient>

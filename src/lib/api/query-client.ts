import { QueryClient } from '@tanstack/react-query'

import { isApiError } from './errors'

export const MAX_READ_RETRIES = 2

/**
 * Retry only reads (GET) that failed for a transient reason: the network, a timeout, or a
 * 5xx response. Client errors and errors that did not come from the API are not retried.
 */
export function shouldRetryRequest(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_READ_RETRIES || !isApiError(error)) return false
  if (error.method !== 'GET') return false
  return error.kind !== 'http' || (error.status !== null && error.status >= 500)
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryRequest },
      mutations: { retry: false },
    },
  })
}

import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { apiFetch } from './client'
import { useApi } from './context'

export const HEALTH_POLL_INTERVAL_MS = 60_000

// `/health/ready` is outside `/api/v1` and not in the OpenAPI document, so it is typed here.
const readinessSchema = z.object({
  status: z.enum(['ok', 'unavailable']),
  checks: z.record(z.string(), z.string()),
})

export class BackendNotReadyError extends Error {
  constructor() {
    super('The backend reported that it is not ready.')
    this.name = 'BackendNotReadyError'
  }
}

/** Resolves when the backend is ready; throws otherwise (network error, non-200, bad body). */
export async function checkReadiness(apiBaseUrl: string, signal?: AbortSignal): Promise<true> {
  const response = await apiFetch(new Request(`${apiBaseUrl}/health/ready`, { signal }))
  const body = readinessSchema.parse(await response.json())
  if (body.status !== 'ok') throw new BackendNotReadyError()
  return true
}

/**
 * Polls backend readiness on start, every minute while the tab is visible, and when the window
 * regains focus. `isUnavailable` stays true from a failed check until a check succeeds.
 */
export function useBackendHealth() {
  const { config } = useApi()
  const query = useQuery({
    queryKey: ['backend-health', config.apiBaseUrl],
    queryFn: ({ signal }) => checkReadiness(config.apiBaseUrl, signal),
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    retry: false,
  })
  return { isUnavailable: query.isError, isChecking: query.isFetching }
}

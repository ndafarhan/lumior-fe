import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { TEST_API_BASE_URL } from '../../../tests/constants'
import { server } from '../../../tests/msw/server'
import { TEST_CONFIG, createTestQueryClient, renderApp } from '../../../tests/render-app'

import { createApiClient } from './client'
import { ApiContext } from './context'
import { HEALTH_POLL_INTERVAL_MS, useBackendHealth } from './health'

const READY_URL = `${TEST_API_BASE_URL}/health/ready`

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ApiContext value={{ client: createApiClient(TEST_CONFIG.apiBaseUrl), config: TEST_CONFIG }}>
      <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
    </ApiContext>
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useBackendHealth', () => {
  test('is available when readiness returns 200 ok', async () => {
    const { result } = renderHook(() => useBackendHealth(), { wrapper })

    await waitFor(() => expect(result.current.isChecking).toBe(false))
    expect(result.current.isUnavailable).toBe(false)
  })

  test('is unavailable when readiness returns 503', async () => {
    server.use(
      http.get(READY_URL, () =>
        HttpResponse.json(
          { status: 'unavailable', checks: { database: 'unavailable' } },
          { status: 503 },
        ),
      ),
    )

    const { result } = renderHook(() => useBackendHealth(), { wrapper })

    await waitFor(() => expect(result.current.isUnavailable).toBe(true))
  })

  test('is unavailable when the backend cannot be reached', async () => {
    server.use(http.get(READY_URL, () => HttpResponse.error()))

    const { result } = renderHook(() => useBackendHealth(), { wrapper })

    await waitFor(() => expect(result.current.isUnavailable).toBe(true))
  })

  test('is unavailable when a 200 response does not report ok', async () => {
    server.use(
      http.get(READY_URL, () =>
        HttpResponse.json({ status: 'unavailable', checks: { database: 'unavailable' } }),
      ),
    )

    const { result } = renderHook(() => useBackendHealth(), { wrapper })

    await waitFor(() => expect(result.current.isUnavailable).toBe(true))
  })

  test('checks again every minute', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    let calls = 0
    server.use(
      http.get(READY_URL, () => {
        calls += 1
        return HttpResponse.json({ status: 'ok', checks: { database: 'ok' } })
      }),
    )

    renderHook(() => useBackendHealth(), { wrapper })
    await vi.waitFor(() => expect(calls).toBe(1))

    await act(() => vi.advanceTimersByTimeAsync(HEALTH_POLL_INTERVAL_MS))
    await vi.waitFor(() => expect(calls).toBe(2))
  })
})

describe('server unavailable banner', () => {
  test('appears while the backend is down and disappears once a check succeeds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    server.use(http.get(READY_URL, () => HttpResponse.error()))

    renderApp('/')

    // Testing Library's async queries poll with the faked timers, so use `vi.waitFor` here.
    await vi.waitFor(() => expect(screen.getByText('Server unavailable')).toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()

    server.resetHandlers()
    await act(() => vi.advanceTimersByTimeAsync(HEALTH_POLL_INTERVAL_MS))

    await vi.waitFor(() => expect(screen.queryByText('Server unavailable')).not.toBeInTheDocument())
  })

  test('is not shown while the backend is healthy', async () => {
    let checked = false
    server.use(
      http.get(READY_URL, () => {
        checked = true
        return HttpResponse.json({ status: 'ok', checks: { database: 'ok' } })
      }),
    )

    renderApp('/')

    await waitFor(() => expect(checked).toBe(true))
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    expect(screen.queryByText('Server unavailable')).not.toBeInTheDocument()
  })
})

import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, test } from 'vitest'

import { server } from '../../../tests/msw/server'

import { apiFetch } from './client'
import { ApiError } from './errors'
import { createQueryClient, shouldRetryRequest } from './query-client'

const URL = 'http://api.test/api/v1/things'

function httpError(status: number, method = 'GET') {
  return new ApiError({ kind: 'http', status, message: 'x', method })
}

describe('shouldRetryRequest', () => {
  test.each([
    ['GET 503', httpError(503), true],
    ['GET 500', httpError(500), true],
    ['GET network', ApiError.network({ requestId: null, method: 'GET' }), true],
    ['GET timeout', ApiError.timeout({ requestId: null, method: 'GET' }), true],
    ['GET 404', httpError(404), false],
    ['GET 422', httpError(422), false],
    ['POST 503', httpError(503, 'POST'), false],
    ['DELETE network', ApiError.network({ requestId: null, method: 'DELETE' }), false],
    ['unknown method', ApiError.network({ requestId: null }), false],
    ['non-API error', new TypeError('boom'), false],
  ])('%s → retry %s', (_label, error, expected) => {
    expect(shouldRetryRequest(0, error)).toBe(expected)
  })

  test('stops after two retries', () => {
    const error = httpError(503)
    expect(shouldRetryRequest(1, error)).toBe(true)
    expect(shouldRetryRequest(2, error)).toBe(false)
  })
})

function setup() {
  const queryClient = createQueryClient()
  // Keep the retry rule but skip the backoff delay.
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retryDelay: 0 },
    mutations: { ...queryClient.getDefaultOptions().mutations, retryDelay: 0 },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { wrapper }
}

function countingHandler(method: 'get' | 'post', responses: Response[]) {
  let calls = 0
  server.use(
    http[method](URL, () => {
      const response = responses[Math.min(calls, responses.length - 1)]!
      calls += 1
      return response.clone()
    }),
  )
  return () => calls
}

const getThings = async () => (await apiFetch(new Request(URL))).json()

describe('query client retry policy', () => {
  test('a GET that fails with 503 and then succeeds resolves with the data', async () => {
    const calls = countingHandler('get', [
      HttpResponse.json({ error: { code: 'service_unavailable', message: 'x' } }, { status: 503 }),
      HttpResponse.json({ ok: true }),
    ])
    const { wrapper } = setup()

    const { result } = renderHook(() => useQuery({ queryKey: ['things'], queryFn: getThings }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ ok: true })
    expect(calls()).toBe(2)
  })

  test('a GET keeps failing after two retries', async () => {
    const calls = countingHandler('get', [
      HttpResponse.json({ error: { code: 'internal_error', message: 'x' } }, { status: 500 }),
    ])
    const { wrapper } = setup()

    const { result } = renderHook(() => useQuery({ queryKey: ['things'], queryFn: getThings }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(calls()).toBe(3)
  })

  test('a GET that fails with 404 is not retried', async () => {
    const calls = countingHandler('get', [
      HttpResponse.json({ error: { code: 'not_found', message: 'x' } }, { status: 404 }),
    ])
    const { wrapper } = setup()

    const { result } = renderHook(() => useQuery({ queryKey: ['things'], queryFn: getThings }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: 404, code: 'not_found' })
    expect(calls()).toBe(1)
  })

  test('a POST that fails with a network error is not retried', async () => {
    const calls = countingHandler('post', [HttpResponse.error()])
    const { wrapper } = setup()

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => (await apiFetch(new Request(URL, { method: 'POST' }))).json(),
        }),
      { wrapper },
    )
    result.current.mutate()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ kind: 'network', method: 'POST' })
    expect(calls()).toBe(1)
  })
})

import { HttpResponse, delay, http } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { server } from '../../../tests/msw/server'

import { REQUEST_TIMEOUT_MS, apiFetch, createApiClient } from './client'
import { ApiError } from './errors'

const BASE = 'http://api.test'

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected the promise to reject')
}

afterEach(() => {
  vi.useRealTimers()
})

describe('apiFetch', () => {
  test('sends a fresh X-Request-ID with each request', async () => {
    const seen: (string | null)[] = []
    server.use(
      http.get(`${BASE}/api/v1/ping`, ({ request }) => {
        seen.push(request.headers.get('X-Request-ID'))
        return HttpResponse.json({ ok: true })
      }),
    )

    await apiFetch(new Request(`${BASE}/api/v1/ping`))
    await apiFetch(new Request(`${BASE}/api/v1/ping`))

    expect(seen).toHaveLength(2)
    for (const id of seen) {
      expect(id).toMatch(/^[\x21-\x7e]{1,128}$/)
    }
    expect(seen[0]).not.toBe(seen[1])
  })

  test('makes requests in credentialed mode', async () => {
    server.use(http.get(`${BASE}/api/v1/ping`, () => HttpResponse.json({})))
    // MSW intercepts below `fetch` in Node and does not keep the credentials mode,
    // so check the request handed to `fetch`.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await apiFetch(new Request(`${BASE}/api/v1/ping`))

    const sent = fetchSpy.mock.calls[0]?.[0]
    expect(sent).toBeInstanceOf(Request)
    expect((sent as Request).credentials).toBe('include')
  })

  test('throws an ApiError with the echoed request ID for an error response', async () => {
    let sentId = ''
    server.use(
      http.get(`${BASE}/api/v1/missing`, ({ request }) => {
        const requestId = request.headers.get('X-Request-ID') ?? ''
        sentId = requestId
        return HttpResponse.json(
          {
            error: { code: 'not_found', message: 'Not Found', details: [], request_id: requestId },
          },
          { status: 404, headers: { 'X-Request-ID': requestId } },
        )
      }),
    )

    const error = await captureError(apiFetch(new Request(`${BASE}/api/v1/missing`)))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: 'http', status: 404, code: 'not_found' })
    expect(sentId).not.toBe('')
    expect((error as ApiError).requestId).toBe(sentId)
  })

  test('reports an unreachable backend as a network error', async () => {
    server.use(http.get(`${BASE}/api/v1/ping`, () => HttpResponse.error()))

    const error = await captureError(apiFetch(new Request(`${BASE}/api/v1/ping`)))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: 'network', status: null, code: 'network_error' })
    expect((error as ApiError).requestId).toMatch(/.+/)
  })

  test('aborts a request that exceeds the timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    server.use(
      http.get(`${BASE}/api/v1/slow`, async () => {
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )

    const pending = captureError(apiFetch(new Request(`${BASE}/api/v1/slow`)))
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    const error = await pending

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: 'timeout', status: null, code: 'timeout' })
  })

  test('does not time out before the limit', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    server.use(
      http.get(`${BASE}/api/v1/slow`, async () => {
        await delay(REQUEST_TIMEOUT_MS - 1_000)
        return HttpResponse.json({ ok: true })
      }),
    )

    const pending = apiFetch(new Request(`${BASE}/api/v1/slow`))
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1_000)
    const response = await pending

    expect(response.status).toBe(200)
  })

  test('rethrows a caller abort unchanged', async () => {
    server.use(
      http.get(`${BASE}/api/v1/slow`, async () => {
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )
    const controller = new AbortController()

    const pending = captureError(
      apiFetch(new Request(`${BASE}/api/v1/slow`, { signal: controller.signal })),
    )
    controller.abort()
    const error = await pending

    expect(error).not.toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ name: 'AbortError' })
  })
})

describe('createApiClient', () => {
  test('sends requests to <base URL>/api/v1 and returns the parsed body', async () => {
    server.use(http.get(`${BASE}/api/v1/ping`, () => HttpResponse.json({ pong: true })))
    const client = createApiClient(BASE)

    // `/ping` is not in the generated schema, so the path is untyped here.
    const { data } = await client.GET('/api/v1/ping' as never)

    expect(data).toEqual({ pong: true })
  })
})

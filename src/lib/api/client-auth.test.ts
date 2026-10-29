import { HttpResponse, http } from 'msw'
import { describe, expect, test, vi } from 'vitest'

import { server } from '../../../tests/msw/server'

import { createApiClient, type AccessTokenSource } from './client'
import { ApiError } from './errors'

const BASE = 'http://api.test'

/** A token source whose refresh hands out `at-2`, `at-3`, ... */
function tokenSource(initial: string | null = 'at-1', refreshFails = false) {
  let token = initial
  let issued = 1
  const source: AccessTokenSource & { refresh: ReturnType<typeof vi.fn> } = {
    getAccessToken: () => token,
    refresh: vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      if (refreshFails) {
        throw new ApiError({
          kind: 'http',
          status: 401,
          code: 'invalid_refresh_token',
          message: 'x',
        })
      }
      token = `at-${++issued}`
      return token
    }),
  }
  return source
}

/** Responds 401 unless the request carries one of `validTokens`. Records each Authorization. */
function protectedEndpoint(method: 'get' | 'post', path: string, validTokens: string[]) {
  const seen: (string | null)[] = []
  const bodies: unknown[] = []
  server.use(
    http[method](`${BASE}${path}`, async ({ request }) => {
      const header = request.headers.get('Authorization')
      seen.push(header)
      if (method === 'post') bodies.push(await request.json())
      if (header && validTokens.includes(header.replace('Bearer ', ''))) {
        return HttpResponse.json({ ok: true })
      }
      return HttpResponse.json(
        { error: { code: 'unauthorized', message: 'Auth required', details: [], request_id: 'r' } },
        { status: 401 },
      )
    }),
  )
  return { seen, bodies }
}

describe('authenticated requests', () => {
  test('carry the access token while signed in', async () => {
    const { seen } = protectedEndpoint('get', '/api/v1/me', ['at-1'])
    const client = createApiClient(BASE, tokenSource('at-1'))

    await client.GET('/api/v1/me')

    expect(seen).toEqual(['Bearer at-1'])
  })

  test('carry no Authorization header while signed out', async () => {
    const { seen } = protectedEndpoint('get', '/api/v1/me', [])
    const client = createApiClient(BASE, tokenSource(null))

    await expect(client.GET('/api/v1/me')).rejects.toBeInstanceOf(ApiError)

    expect(seen).toEqual([null])
  })

  test('never send the token to /api/v1/auth endpoints', async () => {
    const seen: (string | null)[] = []
    server.use(
      http.post(`${BASE}/api/v1/auth/logout`, ({ request }) => {
        seen.push(request.headers.get('Authorization'))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const client = createApiClient(BASE, tokenSource('at-1'))

    await client.POST('/api/v1/auth/logout')

    expect(seen).toEqual([null])
  })
})

describe('401 handling', () => {
  test('a GET is refreshed once and resent with the new token', async () => {
    const { seen } = protectedEndpoint('get', '/api/v1/me', ['at-2'])
    const auth = tokenSource('at-1')
    const client = createApiClient(BASE, auth)

    const { data } = await client.GET('/api/v1/me')

    expect(data).toEqual({ ok: true })
    expect(seen).toEqual(['Bearer at-1', 'Bearer at-2'])
    expect(auth.refresh).toHaveBeenCalledTimes(1)
  })

  test('a POST is resent once with the same body after a refresh', async () => {
    const { seen, bodies } = protectedEndpoint('post', '/api/v1/households', ['at-2'])
    const client = createApiClient(BASE, tokenSource('at-1'))

    await client.POST('/api/v1/households', { body: { name: 'Rumah' } })

    expect(seen).toEqual(['Bearer at-1', 'Bearer at-2'])
    expect(bodies).toEqual([{ name: 'Rumah' }, { name: 'Rumah' }])
  })

  test('three parallel 401s share one refresh', async () => {
    const { seen } = protectedEndpoint('get', '/api/v1/me', ['at-2'])
    const auth = tokenSource('at-1')
    // Share a single in-flight refresh, as the session store does.
    let pending: Promise<string> | null = null
    const refresh = auth.refresh
    const shared: AccessTokenSource = {
      getAccessToken: auth.getAccessToken,
      refresh: () => (pending ??= refresh().finally(() => (pending = null))),
    }
    const client = createApiClient(BASE, shared)

    await Promise.all([
      client.GET('/api/v1/me'),
      client.GET('/api/v1/me'),
      client.GET('/api/v1/me'),
    ])

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(seen.filter((h) => h === 'Bearer at-2')).toHaveLength(3)
  })

  test('a second 401 after refreshing fails without another refresh', async () => {
    const { seen } = protectedEndpoint('get', '/api/v1/me', [])
    const auth = tokenSource('at-1')
    const client = createApiClient(BASE, auth)

    const error = await client.GET('/api/v1/me').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect(seen).toEqual(['Bearer at-1', 'Bearer at-2'])
    expect(auth.refresh).toHaveBeenCalledTimes(1)
  })

  test('a failed refresh rethrows the original 401', async () => {
    const { seen } = protectedEndpoint('get', '/api/v1/me', [])
    const client = createApiClient(BASE, tokenSource('at-1', true))

    const error = await client.GET('/api/v1/me').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('unauthorized')
    expect(seen).toEqual(['Bearer at-1'])
  })
})

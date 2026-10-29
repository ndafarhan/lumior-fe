import { afterEach, describe, expect, test, vi } from 'vitest'

import { ApiError } from '@/lib/api/errors'

import { createSessionStore, type SessionPayload, type SessionStore } from './session'

const USER = { id: 'u-1', email: 'rina@example.com', name: 'Rina' }

function session(token: string): SessionPayload {
  return { access_token: token, token_type: 'bearer', expires_in: 900, user: USER }
}

const unauthorized = () =>
  new ApiError({ kind: 'http', status: 401, code: 'invalid_refresh_token', message: 'Expired' })

const stopListening: (() => void)[] = []
function makeStore(refresh: () => Promise<SessionPayload>, channelName = 'test-session') {
  const store: SessionStore = createSessionStore({ refresh, channelName })
  stopListening.push(store.listenToOtherTabs())
  return store
}

afterEach(() => {
  stopListening.splice(0).forEach((stop) => stop())
})

describe('session store', () => {
  test('starts signed out and signs in with a session', () => {
    const store = makeStore(vi.fn())
    expect(store.getState()).toEqual({ status: 'signed-out', reason: 'initial' })

    store.signIn(session('at-1'))

    expect(store.getState()).toEqual({ status: 'signed-in', user: USER })
    expect(store.getAccessToken()).toBe('at-1')
  })

  test('concurrent refreshes share one request', async () => {
    let resolve!: (value: SessionPayload) => void
    const refresh = vi.fn(() => new Promise<SessionPayload>((r) => (resolve = r)))
    const store = makeStore(refresh)

    const calls = [store.refresh(), store.refresh(), store.refresh()]
    resolve(session('at-2'))

    expect(await Promise.all(calls)).toEqual(['at-2', 'at-2', 'at-2'])
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(store.getAccessToken()).toBe('at-2')

    // A later refresh makes a new request.
    const next = store.refresh()
    resolve(session('at-3'))
    expect(await next).toBe('at-3')
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  test('a rejected refresh while signed in ends the session as expired', async () => {
    const store = makeStore(() => Promise.reject(unauthorized()))
    store.signIn(session('at-1'))

    await expect(store.refresh()).rejects.toBeInstanceOf(ApiError)

    expect(store.getState()).toEqual({ status: 'signed-out', reason: 'expired' })
    expect(store.getAccessToken()).toBeNull()
  })

  test('a rejected refresh on startup keeps the initial signed-out reason', async () => {
    const store = makeStore(() => Promise.reject(unauthorized()))

    await expect(store.refresh()).rejects.toBeInstanceOf(ApiError)

    expect(store.getState()).toEqual({ status: 'signed-out', reason: 'initial' })
  })

  test('a network failure during refresh does not end the session', async () => {
    const store = makeStore(() => Promise.reject(ApiError.network({ requestId: 'r-1' })))
    store.signIn(session('at-1'))

    await expect(store.refresh()).rejects.toBeInstanceOf(ApiError)

    expect(store.getState().status).toBe('signed-in')
  })

  test('signing out in one store signs out another on the same channel', async () => {
    const first = makeStore(vi.fn(), 'shared-channel')
    const second = makeStore(vi.fn(), 'shared-channel')
    first.signIn(session('at-1'))
    second.signIn(session('at-2'))
    const listener = vi.fn()
    second.subscribe(listener)

    first.signOut()

    expect(first.getState()).toEqual({ status: 'signed-out', reason: 'signed-out' })
    await vi.waitFor(() =>
      expect(second.getState()).toEqual({ status: 'signed-out', reason: 'other-tab' }),
    )
    expect(second.getAccessToken()).toBeNull()
    expect(listener).toHaveBeenCalled()
  })

  test('updateUser replaces the profile only while signed in', () => {
    const store = makeStore(vi.fn())
    store.updateUser({ ...USER, name: 'Ignored' })
    expect(store.getState().status).toBe('signed-out')

    store.signIn(session('at-1'))
    store.updateUser({ ...USER, name: 'Rina S.' })
    expect(store.getState()).toEqual({ status: 'signed-in', user: { ...USER, name: 'Rina S.' } })
  })
})

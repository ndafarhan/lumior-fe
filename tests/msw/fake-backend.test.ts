import { describe, expect, test } from 'vitest'

import { TEST_API_BASE_URL } from '../constants'

import { REFRESH_GRACE_MS } from './fake-backend'
import { fakeBackend } from './handlers'

const api = (path: string) => `${TEST_API_BASE_URL}/api/v1${path}`

async function call(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
) {
  const headers = new Headers()
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`)
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  const response = await fetch(api(path), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

async function login(email: string, password = 'password123'): Promise<string> {
  const { body } = await call('POST', '/auth/login', { body: { email, password } })
  return body.access_token
}

describe('auth', () => {
  test('login, refresh, and logout', async () => {
    fakeBackend.addUser({ name: 'Rina', email: 'rina@example.com' })

    const signedIn = await call('POST', '/auth/login', {
      body: { email: 'RINA@example.com', password: 'password123' },
    })
    expect(signedIn.status).toBe(200)
    expect(signedIn.body).toMatchObject({ token_type: 'bearer', user: { name: 'Rina' } })

    const me = await call('GET', '/me', { token: signedIn.body.access_token })
    expect(me.body.email).toBe('rina@example.com')

    const refreshed = await call('POST', '/auth/refresh')
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.access_token).not.toBe(signedIn.body.access_token)

    expect((await call('POST', '/auth/logout')).status).toBe(204)
    const afterLogout = await call('POST', '/auth/refresh')
    expect(afterLogout.status).toBe(401)
    expect(afterLogout.body.error.code).toBe('invalid_refresh_token')
  })

  test('a rotated refresh token is accepted only within the grace period', async () => {
    const user = fakeBackend.addUser({ name: 'Rina', email: 'rina@example.com' })
    fakeBackend.signInAs(user.id)
    const oldCookie = fakeBackend.state.cookieJar
    let now = 1_000_000
    fakeBackend.now = () => now

    await call('POST', '/auth/refresh')
    fakeBackend.state.cookieJar = oldCookie
    expect((await call('POST', '/auth/refresh')).status).toBe(200)

    now += REFRESH_GRACE_MS
    fakeBackend.state.cookieJar = oldCookie
    expect((await call('POST', '/auth/refresh')).status).toBe(401)
  })

  test('wrong credentials are rejected with invalid_credentials', async () => {
    fakeBackend.addUser({ name: 'Rina', email: 'rina@example.com' })
    const result = await call('POST', '/auth/login', {
      body: { email: 'rina@example.com', password: 'nope' },
    })
    expect(result.status).toBe(401)
    expect(result.body.error.code).toBe('invalid_credentials')
  })

  test('registering a taken email returns email_taken', async () => {
    fakeBackend.addUser({ name: 'Rina', email: 'rina@example.com' })
    const result = await call('POST', '/auth/register', {
      body: { name: 'Other', email: 'rina@example.com', password: 'password123' },
    })
    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe('email_taken')
  })

  test('registration validates fields with 422 details', async () => {
    const result = await call('POST', '/auth/register', {
      body: { name: '  ', email: 'x@example.com', password: 'short' },
    })
    expect(result.status).toBe(422)
    expect(result.body.error.details.map((d: { location: string[] }) => d.location)).toEqual([
      ['body', 'name'],
      ['body', 'password'],
    ])
  })

  test('requests without a valid access token get 401 unauthorized', async () => {
    const result = await call('GET', '/me', { token: 'expired' })
    expect(result.status).toBe(401)
    expect(result.body.error.code).toBe('unauthorized')
  })
})

describe('households', () => {
  function seed() {
    const owner = fakeBackend.addUser({ name: 'Rina', email: 'rina@example.com' })
    const budi = fakeBackend.addUser({ name: 'Budi', email: 'budi@example.com' })
    const outsider = fakeBackend.addUser({ name: 'Sari', email: 'sari@example.com' })
    const household = fakeBackend.addHousehold('Rumah Bandung', owner.id, [budi.id])
    return { owner, budi, outsider, household }
  }

  test('members cannot do owner actions: owner_required', async () => {
    const { household } = seed()
    const token = await login('budi@example.com')

    const rename = await call('PATCH', `/households/${household.id}`, {
      token,
      body: { name: 'Mine' },
    })
    expect(rename.status).toBe(403)
    expect(rename.body.error.code).toBe('owner_required')
  })

  test('non-members get not_a_member, unknown households get household_not_found', async () => {
    const { household } = seed()
    const token = await login('sari@example.com')

    const members = await call('GET', `/households/${household.id}/members`, { token })
    expect(members.status).toBe(403)
    expect(members.body.error.code).toBe('not_a_member')

    const missing = await call('GET', '/households/h-999/members', { token })
    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe('household_not_found')
  })

  test('the owner cannot leave', async () => {
    const { owner, household } = seed()
    const token = await login('rina@example.com')
    const result = await call('DELETE', `/households/${household.id}/members/${owner.id}`, {
      token,
    })
    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe('owner_cannot_leave')
  })

  test('an expired invite returns invite_expired', async () => {
    const { owner, household } = seed()
    const invite = fakeBackend.addInvite(household.id, owner.id, Date.now() - 1)
    const token = await login('sari@example.com')

    const result = await call('GET', `/invites/${invite.code}`, { token })
    expect(result.status).toBe(410)
    expect(result.body.error.code).toBe('invite_expired')
  })

  test('accepting an invite joins once; members get already_member', async () => {
    const { owner, household } = seed()
    const invite = fakeBackend.addInvite(household.id, owner.id)

    const budiToken = await login('budi@example.com')
    const preview = await call('GET', `/invites/${invite.code}`, { token: budiToken })
    expect(preview.body).toMatchObject({ household_name: 'Rumah Bandung', already_member: true })
    const again = await call('POST', `/invites/${invite.code}/accept`, { token: budiToken })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('already_member')

    const sariToken = await login('sari@example.com')
    const accepted = await call('POST', `/invites/${invite.code}/accept`, { token: sariToken })
    expect(accepted.status).toBe(200)
    expect(accepted.body).toMatchObject({ name: 'Rumah Bandung', role: 'member' })

    const third = fakeBackend.addUser({ name: 'Tono', email: 'tono@example.com' })
    const tonoToken = await login(third.email)
    const used = await call('GET', `/invites/${invite.code}`, { token: tonoToken })
    expect(used.status).toBe(410)
    expect(used.body.error.code).toBe('invite_used')
  })

  test('households are listed oldest membership first with the caller role', async () => {
    const { budi, household } = seed()
    const other = fakeBackend.addHousehold('Kos Jakarta', budi.id)
    const token = await login('budi@example.com')

    const result = await call('GET', '/households', { token })
    expect(result.body).toEqual([
      { id: household.id, name: 'Rumah Bandung', role: 'member', member_count: 2 },
      { id: other.id, name: 'Kos Jakarta', role: 'owner', member_count: 1 },
    ])
  })
})

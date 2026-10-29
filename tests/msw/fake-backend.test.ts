import { describe, expect, test } from 'vitest'

import { TEST_API_BASE_URL } from '../constants'

import { DEFAULT_EXPENSE_CATEGORIES, REFRESH_GRACE_MS, type FakeState } from './fake-backend'
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
      { id: household.id, name: 'Rumah Bandung', role: 'member', member_count: 2, currency: 'IDR' },
      { id: other.id, name: 'Kos Jakarta', role: 'owner', member_count: 1, currency: 'IDR' },
    ])
  })

  test('a household is created in IDR unless another supported currency is given', async () => {
    fakeBackend.addUser({ name: 'Rina', email: 'rina@example.com' })
    const token = await login('rina@example.com')

    const idr = await call('POST', '/households', { token, body: { name: 'Rumah' } })
    expect(idr.body).toMatchObject({ name: 'Rumah', currency: 'IDR' })
    const sgd = await call('POST', '/households', {
      token,
      body: { name: 'Flat', currency: 'SGD' },
    })
    expect(sgd.body).toMatchObject({ currency: 'SGD' })

    const unknown = await call('POST', '/households', {
      token,
      body: { name: 'Flat', currency: 'XYZ' },
    })
    expect(unknown.status).toBe(422)
    expect(unknown.body.error.details[0].location).toEqual(['body', 'currency'])
  })
})

describe('saved state', () => {
  test('state saved before expenses existed gets currencies, categories, and an expense list', async () => {
    fakeBackend.load({
      users: [{ id: 'u-1', email: 'rina@example.com', name: 'Rina', password: 'password123' }],
      households: [
        {
          id: 'h-2',
          name: 'Rumah Bandung',
          members: [{ userId: 'u-1', role: 'owner', joinedAt: 3 }],
        },
      ],
      invites: [],
      refreshTokens: {},
      accessTokens: {},
      cookieJar: null,
      nextId: 4,
    } as unknown as FakeState)
    const token = await login('rina@example.com')

    const households = await call('GET', '/households', { token })
    expect(households.body[0].currency).toBe('IDR')
    const categories = await call('GET', '/households/h-2/expense-categories', { token })
    expect(categories.body).toHaveLength(DEFAULT_EXPENSE_CATEGORIES.length)
    const expenses = await call('GET', '/households/h-2/expenses?month=2026-10', { token })
    expect(expenses.body.items).toEqual([])
  })
})

describe('expense categories', () => {
  async function seed() {
    const user = fakeBackend.addUser({ name: 'Rina', email: 'rina@example.com' })
    const household = fakeBackend.addHousehold('Rumah Bandung', user.id)
    const token = await login('rina@example.com')
    const path = `/households/${household.id}/expense-categories`
    return { household, token, path }
  }

  test('a new household has the default categories, listed by name', async () => {
    const { token, path } = await seed()
    const result = await call('GET', path, { token })
    expect(result.body.map((c: { name: string }) => c.name)).toEqual(
      [...DEFAULT_EXPENSE_CATEGORIES].sort((a, b) => a.localeCompare(b)),
    )
    expect(result.body.every((c: { archived: boolean }) => !c.archived)).toBe(true)
  })

  test('names are unique ignoring case, including archived categories', async () => {
    const { household, token, path } = await seed()
    fakeBackend.addCategory(household.id, 'Laundry', { archived: true })

    const created = await call('POST', path, { token, body: { name: '  Pets ' } })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ name: 'Pets', archived: false })

    for (const name of ['groceries', 'LAUNDRY']) {
      const taken = await call('POST', path, { token, body: { name } })
      expect(taken.status).toBe(409)
      expect(taken.body.error.code).toBe('category_name_taken')
    }
    const blank = await call('POST', path, { token, body: { name: '   ' } })
    expect(blank.status).toBe(422)
  })

  test('categories can be renamed, archived, and restored', async () => {
    const { household, token, path } = await seed()
    const dining = fakeBackend.category(household.id, 'Dining out')

    const renamed = await call('PATCH', `${path}/${dining.id}`, {
      token,
      body: { name: 'Restaurants' },
    })
    expect(renamed.body).toEqual({ id: dining.id, name: 'Restaurants', archived: false })
    const sameName = await call('PATCH', `${path}/${dining.id}`, {
      token,
      body: { name: 'restaurants' },
    })
    expect(sameName.status).toBe(200)
    const taken = await call('PATCH', `${path}/${dining.id}`, { token, body: { name: 'Other' } })
    expect(taken.body.error.code).toBe('category_name_taken')

    const archived = await call('PATCH', `${path}/${dining.id}`, {
      token,
      body: { archived: true },
    })
    expect(archived.body.archived).toBe(true)
    const restored = await call('PATCH', `${path}/${dining.id}`, {
      token,
      body: { archived: false },
    })
    expect(restored.body.archived).toBe(false)

    const missing = await call('PATCH', `${path}/cat-999`, { token, body: { archived: true } })
    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe('category_not_found')
  })
})

describe('expenses', () => {
  const NOW = Date.parse('2026-10-15T10:00:00Z')

  async function seed(currency = 'IDR') {
    fakeBackend.now = () => NOW
    const user = fakeBackend.addUser({ name: 'Rina', email: 'rina@example.com' })
    const household = fakeBackend.addHousehold('Rumah Bandung', user.id, [], currency)
    const token = await login('rina@example.com')
    const path = `/households/${household.id}/expenses`
    const groceries = fakeBackend.category(household.id, 'Groceries')
    const valid = {
      amount: { amount: '45000', currency },
      spent_on: '2026-10-03',
      category_id: groceries.id,
    }
    return { household, token, path, groceries, valid }
  }

  test('an expense is created with its amount in the currency precision and a trimmed note', async () => {
    const { token, path, valid, groceries } = await seed()
    const created = await call('POST', path, {
      token,
      body: { ...valid, note: '  Weekly market ' },
    })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      amount: { amount: '45000.00', currency: 'IDR' },
      spent_on: '2026-10-03',
      category_id: groceries.id,
      note: 'Weekly market',
    })

    const blankNote = await call('POST', path, { token, body: { ...valid, note: '   ' } })
    expect(blankNote.body.note).toBeNull()
  })

  test('invalid fields are rejected with details', async () => {
    const { token, path, valid } = await seed()
    const cases: [Record<string, unknown>, (string | number)[]][] = [
      [{ amount: { amount: '0', currency: 'IDR' } }, ['body', 'amount', 'amount']],
      [{ amount: { amount: '-5', currency: 'IDR' } }, ['body', 'amount', 'amount']],
      [{ amount: { amount: '10.555', currency: 'IDR' } }, ['body', 'amount', 'amount']],
      [{ amount: { amount: '1234567890123', currency: 'IDR' } }, ['body', 'amount', 'amount']],
      [{ spent_on: '2026-10-17' }, ['body', 'spent_on']],
      [{ spent_on: '1999-12-31' }, ['body', 'spent_on']],
      [{ spent_on: '2026-02-30' }, ['body', 'spent_on']],
      [{ note: 'x'.repeat(501) }, ['body', 'note']],
    ]
    for (const [change, location] of cases) {
      const result = await call('POST', path, { token, body: { ...valid, ...change } })
      expect(result.status, JSON.stringify(change)).toBe(422)
      expect(result.body.error.details[0].location).toEqual(location)
    }

    // One day after the server's UTC date is still accepted.
    const tomorrow = await call('POST', path, { token, body: { ...valid, spent_on: '2026-10-16' } })
    expect(tomorrow.status).toBe(201)
  })

  test('other currencies, unknown categories, and archived categories have their own codes', async () => {
    const { household, token, path, valid } = await seed()
    const mismatch = await call('POST', path, {
      token,
      body: { ...valid, amount: { amount: '10', currency: 'USD' } },
    })
    expect(mismatch.status).toBe(422)
    expect(mismatch.body.error.code).toBe('currency_mismatch')
    expect(mismatch.body.error.details[0].location).toEqual(['body', 'amount', 'currency'])

    const unknown = await call('POST', path, { token, body: { ...valid, category_id: 'cat-999' } })
    expect(unknown.body.error).toMatchObject({ code: 'category_not_found' })

    const laundry = fakeBackend.addCategory(household.id, 'Laundry', { archived: true })
    const archived = await call('POST', path, {
      token,
      body: { ...valid, category_id: laundry.id },
    })
    expect(archived.status).toBe(422)
    expect(archived.body.error.code).toBe('category_archived')
    expect(archived.body.error.details[0].location).toEqual(['body', 'category_id'])
  })

  test('category_archived applies only when an update changes the category', async () => {
    const { household, token, path } = await seed()
    const laundry = fakeBackend.addCategory(household.id, 'Laundry')
    const expense = fakeBackend.addExpense(household.id, {
      amount: '20000',
      spentOn: '2026-10-05',
      category: 'Laundry',
    })
    fakeBackend.addCategory(household.id, 'Laundry', { archived: true })
    const other = fakeBackend.addExpense(household.id, {
      amount: '1000',
      spentOn: '2026-10-05',
      category: 'Groceries',
    })

    const unchanged = await call('PATCH', `${path}/${expense.id}`, {
      token,
      body: { amount: { amount: '25000', currency: 'IDR' }, category_id: laundry.id, note: null },
    })
    expect(unchanged.status).toBe(200)
    expect(unchanged.body).toMatchObject({
      amount: { amount: '25000.00' },
      category_id: laundry.id,
    })

    const changed = await call('PATCH', `${path}/${other.id}`, {
      token,
      body: { category_id: laundry.id },
    })
    expect(changed.body.error.code).toBe('category_archived')
  })

  test("another household's expense is expense_not_found", async () => {
    const { household, token, path } = await seed()
    const stranger = fakeBackend.addUser({ name: 'Sari', email: 'sari@example.com' })
    const elsewhere = fakeBackend.addHousehold('Kos Sari', stranger.id)
    const foreign = fakeBackend.addExpense(elsewhere.id, {
      amount: '1000',
      spentOn: '2026-10-05',
      category: 'Groceries',
    })
    const own = fakeBackend.addExpense(household.id, {
      amount: '1000',
      spentOn: '2026-10-05',
      category: 'Groceries',
    })

    for (const method of ['PATCH', 'DELETE']) {
      const result = await call(method, `${path}/${foreign.id}`, { token, body: {} })
      expect(result.status).toBe(404)
      expect(result.body.error.code).toBe('expense_not_found')
    }
    expect((await call('DELETE', `${path}/${own.id}`, { token })).status).toBe(204)
    expect((await call('DELETE', `${path}/${own.id}`, { token })).status).toBe(404)
  })

  test("a month's expenses are listed newest first, filtered, and paginated", async () => {
    const { household, token, path, groceries } = await seed()
    const add = (spentOn: string, category = 'Groceries') =>
      fakeBackend.addExpense(household.id, { amount: '1000', spentOn, category }).id
    const early = add('2026-10-03')
    const sameDayFirst = add('2026-10-12', 'Transport')
    const sameDaySecond = add('2026-10-12')
    add('2026-09-30')
    add('2026-11-01')

    const all = await call('GET', `${path}?month=2026-10`, { token })
    expect(all.body.items.map((e: { id: string }) => e.id)).toEqual([
      sameDaySecond,
      sameDayFirst,
      early,
    ])
    expect(all.body.next_cursor).toBeNull()

    const filtered = await call('GET', `${path}?month=2026-10&category_id=${groceries.id}`, {
      token,
    })
    expect(filtered.body.items.map((e: { id: string }) => e.id)).toEqual([sameDaySecond, early])
    const unknown = await call('GET', `${path}?month=2026-10&category_id=cat-999`, { token })
    expect(unknown.body.items).toEqual([])

    const first = await call('GET', `${path}?month=2026-10&limit=2`, { token })
    expect(first.body.items).toHaveLength(2)
    const second = await call(
      'GET',
      `${path}?month=2026-10&limit=2&cursor=${first.body.next_cursor}`,
      {
        token,
      },
    )
    expect(second.body.items.map((e: { id: string }) => e.id)).toEqual([early])
    expect(second.body.next_cursor).toBeNull()

    expect(fakeBackend.calls).toContain(`GET /api/v1/households/${household.id}/expenses`)
    expect((await call('GET', `${path}?month=2026-13`, { token })).status).toBe(422)
    expect((await call('GET', `${path}?month=2026-10&cursor=abc`, { token })).status).toBe(422)
    expect((await call('GET', `${path}?month=2026-10&limit=101`, { token })).status).toBe(422)
  })

  test('the summary adds amounts exactly, per category, highest first', async () => {
    const { household, token } = await seed('USD')
    const add = (amount: string, category: string, spentOn = '2026-10-05') =>
      fakeBackend.addExpense(household.id, { amount, spentOn, category })
    add('0.10', 'Groceries')
    add('0.20', 'Groceries')
    add('5', 'Transport')
    add('100', 'Groceries', '2026-09-30')
    const summaryPath = `/households/${household.id}/expense-summary`

    const summary = await call('GET', `${summaryPath}?month=2026-10`, { token })
    expect(summary.body).toEqual({
      month: '2026-10',
      total: { amount: '5.30', currency: 'USD' },
      categories: [
        {
          category_id: fakeBackend.category(household.id, 'Transport').id,
          total: { amount: '5.00', currency: 'USD' },
          count: 1,
        },
        {
          category_id: fakeBackend.category(household.id, 'Groceries').id,
          total: { amount: '0.30', currency: 'USD' },
          count: 2,
        },
      ],
    })

    const empty = await call('GET', `${summaryPath}?month=2026-08`, { token })
    expect(empty.body).toEqual({
      month: '2026-08',
      total: { amount: '0.00', currency: 'USD' },
      categories: [],
    })
    expect((await call('GET', `${summaryPath}?month=oct`, { token })).status).toBe(422)
  })

  test('zero-decimal currencies keep whole amounts', async () => {
    const { household, token } = await seed('JPY')
    fakeBackend.addExpense(household.id, {
      amount: '1500',
      spentOn: '2026-10-05',
      category: 'Other',
    })
    const summary = await call('GET', `/households/${household.id}/expense-summary?month=2026-10`, {
      token,
    })
    expect(summary.body.total).toEqual({ amount: '1500', currency: 'JPY' })
  })

  test('non-members get not_a_member on expense paths', async () => {
    const { household } = await seed()
    fakeBackend.addUser({ name: 'Sari', email: 'sari@example.com' })
    const token = await login('sari@example.com')
    const result = await call('GET', `/households/${household.id}/expenses?month=2026-10`, {
      token,
    })
    expect(result.status).toBe(403)
    expect(result.body.error.code).toBe('not_a_member')
  })
})

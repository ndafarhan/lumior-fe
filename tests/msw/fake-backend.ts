import { HttpResponse, http, type HttpHandler } from 'msw'

import { CURRENCY_PRECISION } from '@/lib/money/currency'

/**
 * In-memory implementation of the auth, households, and expenses contract
 * (`contracts/openapi.json`).
 * Tests use it through MSW in Node; the dev mock mode uses it through the browser worker.
 *
 * It simulates one browser: the refresh cookie lives in `cookieJar` instead of a real cookie,
 * because neither Node fetch nor a service worker stores cookies from mocked responses.
 */

export type Role = 'owner' | 'member'

type FakeUser = { id: string; email: string; name: string; password: string }
/** `joinedAt` is a sequence number, so memberships created in the same millisecond still order. */
type FakeMembership = { userId: string; role: Role; joinedAt: number }
type FakeCategory = { id: string; name: string; archived: boolean }
type FakeHousehold = {
  id: string
  name: string
  currency: string
  members: FakeMembership[]
  categories: FakeCategory[]
}
/** `amount` is a decimal string with the currency's decimal places; `seq` orders same-day entries. */
type FakeExpense = {
  id: string
  householdId: string
  amount: string
  spentOn: string
  categoryId: string
  note: string | null
  createdAt: number
  updatedAt: number
  seq: number
}
type FakeInvite = {
  code: string
  householdId: string
  invitedBy: string
  expiresAt: number
  usedBy: string | null
}
type FakeRefreshToken = { userId: string; rotatedAt: number | null }

export type FakeState = {
  users: FakeUser[]
  households: FakeHousehold[]
  invites: FakeInvite[]
  expenses: FakeExpense[]
  refreshTokens: Record<string, FakeRefreshToken>
  accessTokens: Record<string, string>
  cookieJar: string | null
  nextId: number
}

export const ACCESS_TOKEN_TTL_S = 900
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** A refresh token replaced less than this long ago is still accepted (concurrent tabs). */
export const REFRESH_GRACE_MS = 30_000

/** Every household starts with these categories (`contracts/expenses.md`). */
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Groceries',
  'Dining out',
  'Transport',
  'Utilities',
  'Housing',
  'Health',
  'Education',
  'Entertainment',
  'Other',
] as const

export const DEFAULT_EXPENSE_PAGE_SIZE = 50

function emptyState(): FakeState {
  return {
    users: [],
    households: [],
    invites: [],
    expenses: [],
    refreshTokens: {},
    accessTokens: {},
    cookieJar: null,
    nextId: 1,
  }
}

type ErrorDetail = { location: (string | number)[]; reason: string; type: string }

function errorResponse(status: number, code: string, message: string, details: ErrorDetail[] = []) {
  const requestId = `fake-${Math.random().toString(36).slice(2, 10)}`
  return HttpResponse.json(
    { error: { code, message, details, request_id: requestId } },
    { status, headers: { 'X-Request-ID': requestId } },
  )
}

function validationError(details: ErrorDetail[]) {
  return errorResponse(422, 'validation_error', 'Request validation failed.', details)
}

function nameIssue(field: string, value: unknown): ErrorDetail | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed.length < 1 || trimmed.length > 100) {
    return {
      location: ['body', field],
      reason: 'Must be 1 to 100 characters.',
      type: 'string_length',
    }
  }
  return null
}

function passwordIssue(field: string, value: unknown): ErrorDetail | null {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    return {
      location: ['body', field],
      reason: 'Must be 8 to 128 characters.',
      type: 'string_length',
    }
  }
  return null
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const DECIMAL = /^(\d+)(?:\.(\d+))?$/
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

/** `"12.5"` → `1250n` for a currency with 2 decimal places. The input must match `DECIMAL`. */
function toMinorUnits(amount: string, precision: number): bigint {
  const [, integer = '0', fraction = ''] = DECIMAL.exec(amount)!
  return BigInt(integer + fraction.padEnd(precision, '0'))
}

/** `1250n` → `"12.50"` for a currency with 2 decimal places. */
function fromMinorUnits(units: bigint, precision: number): string {
  const digits = units.toString().padStart(precision + 1, '0')
  if (precision === 0) return digits
  return `${digits.slice(0, -precision)}.${digits.slice(-precision)}`
}

/** Whether `value` is a real calendar date written as `YYYY-MM-DD`. */
function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function categoryNameIssue(value: unknown): ErrorDetail | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed.length < 1 || trimmed.length > 50) {
    return {
      location: ['body', 'name'],
      reason: 'Must be 1 to 50 characters.',
      type: 'string_length',
    }
  }
  return null
}

export class FakeBackend {
  state: FakeState = emptyState()
  /** Milliseconds since the epoch; tests can move it to expire invites. */
  now: () => number = () => Date.now()
  /** Called after every change, for example to persist the dev mock state. */
  onChange: ((state: FakeState) => void) | null = null
  /** Every request path the handlers served, in order. */
  readonly calls: string[] = []

  reset() {
    this.state = emptyState()
    this.now = () => Date.now()
    this.calls.length = 0
  }

  /** Loads saved state, filling in what state saved by an older version lacks. */
  load(state: FakeState) {
    state.expenses ??= []
    for (const household of state.households) {
      household.currency ??= 'IDR'
      household.categories ??= this.defaultCategories(state)
    }
    this.state = state
  }

  private defaultCategories(state = this.state): FakeCategory[] {
    return DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
      id: `cat-${state.nextId++}`,
      name,
      archived: false,
    }))
  }

  private id(prefix: string) {
    return `${prefix}-${this.state.nextId++}`
  }

  private changed() {
    this.onChange?.(this.state)
  }

  // --- Seeding helpers for tests -------------------------------------------------------------

  addUser(input: { name: string; email: string; password?: string }): FakeUser {
    const user = { id: this.id('u'), password: 'password123', ...input }
    this.state.users.push(user)
    this.changed()
    return user
  }

  addHousehold(
    name: string,
    ownerId: string,
    memberIds: string[] = [],
    currency = 'IDR',
  ): FakeHousehold {
    const household: FakeHousehold = {
      id: this.id('h'),
      name,
      currency,
      categories: this.defaultCategories(),
      members: [
        { userId: ownerId, role: 'owner', joinedAt: this.state.nextId++ },
        ...memberIds.map((userId) => ({
          userId,
          role: 'member' as const,
          joinedAt: this.state.nextId++,
        })),
      ],
    }
    this.state.households.push(household)
    this.changed()
    return household
  }

  addInvite(householdId: string, invitedBy: string, expiresAt = this.now() + INVITE_TTL_MS) {
    const invite: FakeInvite = {
      code: this.id('inv'),
      householdId,
      invitedBy,
      expiresAt,
      usedBy: null,
    }
    this.state.invites.push(invite)
    this.changed()
    return invite
  }

  /** Adds a category, or returns the existing one with that name. */
  addCategory(householdId: string, name: string, { archived = false } = {}): FakeCategory {
    const household = this.household(householdId)!
    let category = household.categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (!category) {
      category = { id: this.id('cat'), name, archived }
      household.categories.push(category)
    }
    category.archived = archived
    this.changed()
    return category
  }

  /** The household's category with that name. Throws if there is none. */
  category(householdId: string, name: string): FakeCategory {
    const category = this.household(householdId)?.categories.find((c) => c.name === name)
    if (!category) throw new Error(`No category "${name}" in household ${householdId}`)
    return category
  }

  /**
   * Adds an expense. `amount` is a plain decimal string in the household currency, and
   * `category` a category name (created when missing).
   */
  addExpense(
    householdId: string,
    input: { amount: string; spentOn: string; category: string; note?: string | null },
  ): FakeExpense {
    const household = this.household(householdId)!
    const category =
      household.categories.find((c) => c.name === input.category) ??
      this.addCategory(householdId, input.category)
    const precision = CURRENCY_PRECISION[household.currency] ?? 2
    const expense: FakeExpense = {
      id: this.id('exp'),
      householdId,
      amount: fromMinorUnits(toMinorUnits(input.amount, precision), precision),
      spentOn: input.spentOn,
      categoryId: category.id,
      note: input.note ?? null,
      createdAt: this.now(),
      updatedAt: this.now(),
      seq: this.state.nextId++,
    }
    this.state.expenses.push(expense)
    this.changed()
    return expense
  }

  /** Puts a valid refresh cookie in the simulated browser, as if the user had signed in. */
  signInAs(userId: string) {
    this.state.cookieJar = this.issueRefreshToken(userId)
    this.changed()
  }

  /** Makes every issued access token invalid, as if they had expired. */
  expireAccessTokens() {
    this.state.accessTokens = {}
  }

  /** Makes every refresh token invalid, as if the session had expired on the server. */
  revokeRefreshTokens() {
    this.state.refreshTokens = {}
  }

  removeMember(householdId: string, userId: string) {
    const household = this.state.households.find((h) => h.id === householdId)
    if (household) household.members = household.members.filter((m) => m.userId !== userId)
    this.changed()
  }

  user(id: string) {
    return this.state.users.find((user) => user.id === id)
  }

  household(id: string) {
    return this.state.households.find((household) => household.id === id)
  }

  // --- Token handling ------------------------------------------------------------------------

  private issueRefreshToken(userId: string) {
    const token = this.id('rt')
    this.state.refreshTokens[token] = { userId, rotatedAt: null }
    return token
  }

  private session(userId: string) {
    const accessToken = this.id('at')
    this.state.accessTokens[accessToken] = userId
    this.state.cookieJar = this.issueRefreshToken(userId)
    this.changed()
    const user = this.user(userId)!
    return {
      access_token: accessToken,
      token_type: 'bearer' as const,
      expires_in: ACCESS_TOKEN_TTL_S,
      user: publicUser(user),
    }
  }

  private authenticate(request: Request): FakeUser | null {
    const header = request.headers.get('Authorization') ?? ''
    const match = /^Bearer (.+)$/.exec(header)
    const userId = match ? this.state.accessTokens[match[1]!] : undefined
    return userId ? (this.user(userId) ?? null) : null
  }

  private membership(household: FakeHousehold, userId: string) {
    return household.members.find((member) => member.userId === userId)
  }

  private householdView(household: FakeHousehold, userId: string) {
    return {
      id: household.id,
      name: household.name,
      role: this.membership(household, userId)!.role,
      member_count: household.members.length,
      currency: household.currency,
    }
  }

  private money(household: FakeHousehold, amount: string) {
    return { amount, currency: household.currency }
  }

  private expenseView(household: FakeHousehold, expense: FakeExpense) {
    return {
      id: expense.id,
      amount: this.money(household, expense.amount),
      spent_on: expense.spentOn,
      category_id: expense.categoryId,
      note: expense.note,
      created_at: new Date(expense.createdAt).toISOString(),
      updated_at: new Date(expense.updatedAt).toISOString(),
    }
  }

  /**
   * Checks an expense body against the contract's rules. `current` is the expense being
   * updated: omitted fields keep its values, and its own archived category stays allowed.
   */
  private checkExpense(
    household: FakeHousehold,
    body: Record<string, unknown>,
    current?: FakeExpense,
  ):
    | { error: Response }
    | { amount?: string; spentOn?: string; categoryId?: string; note?: string | null } {
    const issues: ErrorDetail[] = []
    const result: { amount?: string; spentOn?: string; categoryId?: string; note?: string | null } =
      {}
    const precision = CURRENCY_PRECISION[household.currency] ?? 2

    if (!current || 'amount' in body) {
      const money = body.amount as { amount?: unknown; currency?: unknown } | undefined
      const match = typeof money?.amount === 'string' ? DECIMAL.exec(money.amount) : null
      if (!match) {
        issues.push({
          location: ['body', 'amount', 'amount'],
          reason: 'Must be a decimal string.',
          type: 'decimal',
        })
      } else if ((match[2] ?? '').length > precision) {
        issues.push({
          location: ['body', 'amount', 'amount'],
          reason: `At most ${precision} decimal places.`,
          type: 'decimal',
        })
      } else if (match[1]!.replace(/^0+(?=\d)/, '').length > 12) {
        issues.push({
          location: ['body', 'amount', 'amount'],
          reason: 'At most 12 digits before the decimal point.',
          type: 'decimal',
        })
      } else if (toMinorUnits(money!.amount as string, precision) <= 0n) {
        issues.push({
          location: ['body', 'amount', 'amount'],
          reason: 'Must be greater than 0.',
          type: 'greater_than',
        })
      } else if (money!.currency !== household.currency) {
        return {
          error: errorResponse(
            422,
            'currency_mismatch',
            'Expenses must use the household currency.',
            [
              {
                location: ['body', 'amount', 'currency'],
                reason: `Must be ${household.currency}.`,
                type: 'currency_mismatch',
              },
            ],
          ),
        }
      } else {
        result.amount = fromMinorUnits(toMinorUnits(money!.amount as string, precision), precision)
      }
    }

    if (!current || 'spent_on' in body) {
      const latest = new Date(this.now() + DAY_MS).toISOString().slice(0, 10)
      if (!isDate(body.spent_on) || body.spent_on < '2000-01-01' || body.spent_on > latest) {
        issues.push({
          location: ['body', 'spent_on'],
          reason: 'Must be a date between 2000-01-01 and today.',
          type: 'date',
        })
      } else {
        result.spentOn = body.spent_on
      }
    }

    if (!current || 'note' in body) {
      const note = body.note
      if (note !== undefined && note !== null && typeof note !== 'string') {
        issues.push({
          location: ['body', 'note'],
          reason: 'Must be a string.',
          type: 'string_type',
        })
      } else if (typeof note === 'string' && note.trim().length > 500) {
        issues.push({
          location: ['body', 'note'],
          reason: 'At most 500 characters.',
          type: 'string_length',
        })
      } else {
        result.note = typeof note === 'string' && note.trim() ? note.trim() : null
      }
    }

    if (issues.length) return { error: validationError(issues) }

    if (!current || 'category_id' in body) {
      const category = household.categories.find((c) => c.id === body.category_id)
      const location = ['body', 'category_id']
      if (!category) {
        return {
          error: errorResponse(422, 'category_not_found', 'This category does not exist.', [
            { location, reason: 'Unknown category.', type: 'category_not_found' },
          ]),
        }
      }
      if (category.archived && category.id !== current?.categoryId) {
        return {
          error: errorResponse(422, 'category_archived', 'This category is archived.', [
            { location, reason: 'This category is archived.', type: 'category_archived' },
          ]),
        }
      }
      result.categoryId = category.id
    }
    return result
  }

  /** The household's expenses in `month`, newest first (date, then recording order). */
  private monthExpenses(household: FakeHousehold, month: string) {
    return this.state.expenses
      .filter((e) => e.householdId === household.id && e.spentOn.startsWith(`${month}-`))
      .sort((a, b) => (a.spentOn === b.spentOn ? b.seq - a.seq : a.spentOn < b.spentOn ? 1 : -1))
  }

  private monthIssue(value: string | null): ErrorDetail | null {
    return value && MONTH.test(value)
      ? null
      : { location: ['query', 'month'], reason: 'Must be YYYY-MM.', type: 'pattern' }
  }

  // --- Handlers ------------------------------------------------------------------------------

  handlers(baseUrl: string): HttpHandler[] {
    const url = (path: string) => `${baseUrl}/api/v1${path}`
    const track = (request: Request) => {
      this.calls.push(`${request.method} ${new URL(request.url).pathname}`)
    }

    /** Wraps a handler that needs a signed-in user. */
    const authed =
      (
        handler: (args: {
          request: Request
          params: Record<string, string>
          user: FakeUser
        }) => Response | Promise<Response>,
      ) =>
      ({ request, params }: { request: Request; params: Record<string, unknown> }) => {
        track(request)
        const user = this.authenticate(request)
        if (!user) return errorResponse(401, 'unauthorized', 'Authentication required.')
        return handler({ request, params: params as Record<string, string>, user })
      }

    /** Wraps a handler for `/households/{household_id}/...` that needs membership. */
    const member = (
      handler: (args: {
        request: Request
        params: Record<string, string>
        user: FakeUser
        household: FakeHousehold
        role: Role
      }) => Response | Promise<Response>,
    ) =>
      authed(({ request, params, user }) => {
        const household = this.household(params.household_id!)
        if (!household) return errorResponse(404, 'household_not_found', 'Household not found.')
        const membership = this.membership(household, user.id)
        if (!membership) {
          return errorResponse(403, 'not_a_member', 'You are not a member of this household.')
        }
        return handler({ request, params, user, household, role: membership.role })
      })

    const ownerRequired = () =>
      errorResponse(403, 'owner_required', 'Only the household owner can do this.')

    const findInvite = (code: string, userId: string) => {
      const invite = this.state.invites.find((candidate) => candidate.code === code)
      if (!invite || !this.household(invite.householdId)) {
        return { error: errorResponse(404, 'invite_not_found', 'This invite does not exist.') }
      }
      if (invite.usedBy !== null && invite.usedBy !== userId) {
        return { error: errorResponse(410, 'invite_used', 'This invite has already been used.') }
      }
      if (invite.expiresAt <= this.now()) {
        return { error: errorResponse(410, 'invite_expired', 'This invite has expired.') }
      }
      return { invite, household: this.household(invite.householdId)! }
    }

    return [
      http.post(url('/auth/register'), async ({ request }) => {
        track(request)
        const body = await readJson(request)
        const issues = [
          nameIssue('name', body.name),
          typeof body.email === 'string' && body.email.includes('@')
            ? null
            : {
                location: ['body', 'email'],
                reason: 'Must be a valid email.',
                type: 'value_error',
              },
          passwordIssue('password', body.password),
        ].filter((issue): issue is ErrorDetail => issue !== null)
        if (issues.length) return validationError(issues)

        const email = (body.email as string).toLowerCase()
        if (this.state.users.some((user) => user.email.toLowerCase() === email)) {
          return errorResponse(409, 'email_taken', 'An account with this email already exists.')
        }
        const user = this.addUser({
          name: (body.name as string).trim(),
          email: body.email as string,
          password: body.password as string,
        })
        return HttpResponse.json(this.session(user.id), { status: 201 })
      }),

      http.post(url('/auth/login'), async ({ request }) => {
        track(request)
        const body = await readJson(request)
        const email = typeof body.email === 'string' ? body.email.toLowerCase() : ''
        const user = this.state.users.find((candidate) => candidate.email.toLowerCase() === email)
        if (!user || user.password !== body.password) {
          return errorResponse(401, 'invalid_credentials', 'Incorrect email or password.')
        }
        return HttpResponse.json(this.session(user.id))
      }),

      http.post(url('/auth/refresh'), ({ request }) => {
        track(request)
        const token = this.state.cookieJar
        const record = token ? this.state.refreshTokens[token] : undefined
        const usable =
          record && (record.rotatedAt === null || this.now() - record.rotatedAt < REFRESH_GRACE_MS)
        if (!token || !record || !usable) {
          return errorResponse(401, 'invalid_refresh_token', 'The session has expired.')
        }
        record.rotatedAt ??= this.now()
        return HttpResponse.json(this.session(record.userId))
      }),

      http.post(url('/auth/logout'), ({ request }) => {
        track(request)
        if (this.state.cookieJar) delete this.state.refreshTokens[this.state.cookieJar]
        this.state.cookieJar = null
        this.changed()
        return new HttpResponse(null, { status: 204 })
      }),

      http.get(
        url('/me'),
        authed(({ user }) => HttpResponse.json(publicUser(user))),
      ),

      http.patch(
        url('/me'),
        authed(async ({ request, user }) => {
          const body = await readJson(request)
          const issue = nameIssue('name', body.name)
          if (issue) return validationError([issue])
          user.name = (body.name as string).trim()
          this.changed()
          return HttpResponse.json(publicUser(user))
        }),
      ),

      http.post(
        url('/me/password'),
        authed(async ({ request, user }) => {
          const body = await readJson(request)
          const issue = passwordIssue('new_password', body.new_password)
          if (issue) return validationError([issue])
          if (body.current_password !== user.password) {
            return errorResponse(
              400,
              'invalid_current_password',
              'The current password is incorrect.',
            )
          }
          user.password = body.new_password as string
          this.changed()
          return new HttpResponse(null, { status: 204 })
        }),
      ),

      http.get(
        url('/households'),
        authed(({ user }) => {
          const households = this.state.households
            .filter((household) => this.membership(household, user.id))
            .sort(
              (a, b) =>
                this.membership(a, user.id)!.joinedAt - this.membership(b, user.id)!.joinedAt,
            )
            .map((household) => this.householdView(household, user.id))
          return HttpResponse.json(households)
        }),
      ),

      http.post(
        url('/households'),
        authed(async ({ request, user }) => {
          const body = await readJson(request)
          const currency = body.currency ?? 'IDR'
          const issues = [
            nameIssue('name', body.name),
            typeof currency === 'string' && currency in CURRENCY_PRECISION
              ? null
              : {
                  location: ['body', 'currency'],
                  reason: 'Unsupported currency.',
                  type: 'value_error',
                },
          ].filter((issue): issue is ErrorDetail => issue !== null)
          if (issues.length) return validationError(issues)
          const household = this.addHousehold(
            (body.name as string).trim(),
            user.id,
            [],
            currency as string,
          )
          return HttpResponse.json(this.householdView(household, user.id), { status: 201 })
        }),
      ),

      http.patch(
        url('/households/:household_id'),
        member(async ({ request, user, household, role }) => {
          if (role !== 'owner') return ownerRequired()
          const body = await readJson(request)
          const issue = nameIssue('name', body.name)
          if (issue) return validationError([issue])
          household.name = (body.name as string).trim()
          this.changed()
          return HttpResponse.json(this.householdView(household, user.id))
        }),
      ),

      http.get(
        url('/households/:household_id/members'),
        member(({ household }) =>
          HttpResponse.json(
            household.members.map((membership) => {
              const memberUser = this.user(membership.userId)!
              return {
                user_id: memberUser.id,
                name: memberUser.name,
                email: memberUser.email,
                role: membership.role,
              }
            }),
          ),
        ),
      ),

      http.delete(
        url('/households/:household_id/members/:user_id'),
        member(({ params, user, household, role }) => {
          const targetId = params.user_id!
          const target = this.membership(household, targetId)
          if (targetId !== user.id && role !== 'owner') return ownerRequired()
          if (!target) return errorResponse(404, 'member_not_found', 'Member not found.')
          if (target.role === 'owner') {
            return errorResponse(409, 'owner_cannot_leave', 'The owner cannot leave the household.')
          }
          this.removeMember(household.id, targetId)
          return new HttpResponse(null, { status: 204 })
        }),
      ),

      http.post(
        url('/households/:household_id/invites'),
        member(({ user, household, role }) => {
          if (role !== 'owner') return ownerRequired()
          const invite = this.addInvite(household.id, user.id)
          return HttpResponse.json(
            { code: invite.code, expires_at: new Date(invite.expiresAt).toISOString() },
            { status: 201 },
          )
        }),
      ),

      http.get(
        url('/invites/:code'),
        authed(({ params, user }) => {
          const found = findInvite(params.code!, user.id)
          if (found.error) return found.error
          const { invite, household } = found
          return HttpResponse.json({
            household_id: household.id,
            household_name: household.name,
            invited_by: this.user(invite.invitedBy)?.name ?? 'A member',
            expires_at: new Date(invite.expiresAt).toISOString(),
            already_member: Boolean(this.membership(household, user.id)),
          })
        }),
      ),

      http.post(
        url('/invites/:code/accept'),
        authed(({ params, user }) => {
          const found = findInvite(params.code!, user.id)
          if (found.error) return found.error
          const { invite, household } = found
          if (this.membership(household, user.id)) {
            return errorResponse(409, 'already_member', 'You are already a member.')
          }
          household.members.push({ userId: user.id, role: 'member', joinedAt: this.state.nextId++ })
          invite.usedBy = user.id
          this.changed()
          return HttpResponse.json(this.householdView(household, user.id))
        }),
      ),

      ...this.expenseHandlers(url, member),
    ]
  }

  private expenseHandlers(
    url: (path: string) => string,
    member: (
      handler: (args: {
        request: Request
        params: Record<string, string>
        household: FakeHousehold
      }) => Response | Promise<Response>,
    ) => (args: {
      request: Request
      params: Record<string, unknown>
    }) => Response | Promise<Response>,
  ): HttpHandler[] {
    const sortedCategories = (household: FakeHousehold) =>
      [...household.categories].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      )
    const nameTaken = (household: FakeHousehold, name: string, exceptId?: string) =>
      household.categories.some(
        (c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase(),
      )
    const nameTakenError = () =>
      errorResponse(409, 'category_name_taken', 'A category with this name already exists.', [
        { location: ['body', 'name'], reason: 'Already used.', type: 'category_name_taken' },
      ])
    const expenseNotFound = () =>
      errorResponse(404, 'expense_not_found', 'This expense does not exist.')
    const findExpense = (household: FakeHousehold, id: string) =>
      this.state.expenses.find((e) => e.id === id && e.householdId === household.id)

    return [
      http.get(
        url('/households/:household_id/expense-categories'),
        member(({ household }) => HttpResponse.json(sortedCategories(household))),
      ),

      http.post(
        url('/households/:household_id/expense-categories'),
        member(async ({ request, household }) => {
          const body = await readJson(request)
          const issue = categoryNameIssue(body.name)
          if (issue) return validationError([issue])
          const name = (body.name as string).trim()
          if (nameTaken(household, name)) return nameTakenError()
          const category = { id: this.id('cat'), name, archived: false }
          household.categories.push(category)
          this.changed()
          return HttpResponse.json(category, { status: 201 })
        }),
      ),

      http.patch(
        url('/households/:household_id/expense-categories/:category_id'),
        member(async ({ request, params, household }) => {
          const category = household.categories.find((c) => c.id === params.category_id)
          if (!category) return errorResponse(404, 'category_not_found', 'Category not found.')
          const body = await readJson(request)
          const issues: ErrorDetail[] = []
          if ('name' in body) {
            const issue = categoryNameIssue(body.name)
            if (issue) issues.push(issue)
          }
          if ('archived' in body && typeof body.archived !== 'boolean') {
            issues.push({
              location: ['body', 'archived'],
              reason: 'Must be a boolean.',
              type: 'bool_type',
            })
          }
          if (issues.length) return validationError(issues)
          if ('name' in body) {
            const name = (body.name as string).trim()
            if (nameTaken(household, name, category.id)) return nameTakenError()
            category.name = name
          }
          if ('archived' in body) category.archived = body.archived as boolean
          this.changed()
          return HttpResponse.json(category)
        }),
      ),

      http.get(
        url('/households/:household_id/expenses'),
        member(({ request, household }) => {
          const query = new URL(request.url).searchParams
          const month = query.get('month')
          const issues: ErrorDetail[] = []
          const monthIssue = this.monthIssue(month)
          if (monthIssue) issues.push(monthIssue)
          const limit = query.has('limit') ? Number(query.get('limit')) : DEFAULT_EXPENSE_PAGE_SIZE
          if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            issues.push({
              location: ['query', 'limit'],
              reason: 'Must be 1 to 100.',
              type: 'range',
            })
          }
          const cursor = query.get('cursor')
          const start = cursor === null ? 0 : Number(cursor)
          if (cursor !== null && (!/^\d+$/.test(cursor) || !Number.isSafeInteger(start))) {
            issues.push({
              location: ['query', 'cursor'],
              reason: 'Invalid cursor.',
              type: 'value_error',
            })
          }
          if (issues.length) return validationError(issues)

          const categoryId = query.get('category_id')
          const matching = this.monthExpenses(household, month!).filter(
            (e) => categoryId === null || e.categoryId === categoryId,
          )
          const end = start + limit
          return HttpResponse.json({
            items: matching.slice(start, end).map((e) => this.expenseView(household, e)),
            next_cursor: end < matching.length ? String(end) : null,
          })
        }),
      ),

      http.post(
        url('/households/:household_id/expenses'),
        member(async ({ request, household }) => {
          const checked = this.checkExpense(household, await readJson(request))
          if ('error' in checked) return checked.error
          const expense: FakeExpense = {
            id: this.id('exp'),
            householdId: household.id,
            amount: checked.amount!,
            spentOn: checked.spentOn!,
            categoryId: checked.categoryId!,
            note: checked.note ?? null,
            createdAt: this.now(),
            updatedAt: this.now(),
            seq: this.state.nextId++,
          }
          this.state.expenses.push(expense)
          this.changed()
          return HttpResponse.json(this.expenseView(household, expense), { status: 201 })
        }),
      ),

      http.patch(
        url('/households/:household_id/expenses/:expense_id'),
        member(async ({ request, params, household }) => {
          const expense = findExpense(household, params.expense_id!)
          if (!expense) return expenseNotFound()
          const checked = this.checkExpense(household, await readJson(request), expense)
          if ('error' in checked) return checked.error
          if (checked.amount !== undefined) expense.amount = checked.amount
          if (checked.spentOn !== undefined) expense.spentOn = checked.spentOn
          if (checked.categoryId !== undefined) expense.categoryId = checked.categoryId
          if (checked.note !== undefined) expense.note = checked.note
          expense.updatedAt = this.now()
          this.changed()
          return HttpResponse.json(this.expenseView(household, expense))
        }),
      ),

      http.delete(
        url('/households/:household_id/expenses/:expense_id'),
        member(({ params, household }) => {
          const expense = findExpense(household, params.expense_id!)
          if (!expense) return expenseNotFound()
          this.state.expenses = this.state.expenses.filter((e) => e !== expense)
          this.changed()
          return new HttpResponse(null, { status: 204 })
        }),
      ),

      http.get(
        url('/households/:household_id/expense-summary'),
        member(({ request, household }) => {
          const month = new URL(request.url).searchParams.get('month')
          const issue = this.monthIssue(month)
          if (issue) return validationError([issue])
          const precision = CURRENCY_PRECISION[household.currency] ?? 2
          let total = 0n
          const perCategory = new Map<string, { total: bigint; count: number }>()
          for (const expense of this.monthExpenses(household, month!)) {
            const units = toMinorUnits(expense.amount, precision)
            total += units
            const entry = perCategory.get(expense.categoryId) ?? { total: 0n, count: 0 }
            entry.total += units
            entry.count += 1
            perCategory.set(expense.categoryId, entry)
          }
          const categories = [...perCategory.entries()]
            .sort(([, a], [, b]) => (a.total === b.total ? 0 : a.total < b.total ? 1 : -1))
            .map(([categoryId, entry]) => ({
              category_id: categoryId,
              total: this.money(household, fromMinorUnits(entry.total, precision)),
              count: entry.count,
            }))
          return HttpResponse.json({
            month,
            total: this.money(household, fromMinorUnits(total, precision)),
            categories,
          })
        }),
      ),
    ]
  }
}

function publicUser(user: FakeUser) {
  return { id: user.id, email: user.email, name: user.name }
}

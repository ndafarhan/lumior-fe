import { HttpResponse, http, type HttpHandler } from 'msw'

/**
 * In-memory implementation of the auth and households contract (`contracts/openapi.json`).
 * Tests use it through MSW in Node; the dev mock mode uses it through the browser worker.
 *
 * It simulates one browser: the refresh cookie lives in `cookieJar` instead of a real cookie,
 * because neither Node fetch nor a service worker stores cookies from mocked responses.
 */

export type Role = 'owner' | 'member'

type FakeUser = { id: string; email: string; name: string; password: string }
/** `joinedAt` is a sequence number, so memberships created in the same millisecond still order. */
type FakeMembership = { userId: string; role: Role; joinedAt: number }
type FakeHousehold = { id: string; name: string; members: FakeMembership[] }
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
  refreshTokens: Record<string, FakeRefreshToken>
  accessTokens: Record<string, string>
  cookieJar: string | null
  nextId: number
}

export const ACCESS_TOKEN_TTL_S = 900
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** A refresh token replaced less than this long ago is still accepted (concurrent tabs). */
export const REFRESH_GRACE_MS = 30_000

function emptyState(): FakeState {
  return {
    users: [],
    households: [],
    invites: [],
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

  load(state: FakeState) {
    this.state = state
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

  addHousehold(name: string, ownerId: string, memberIds: string[] = []): FakeHousehold {
    const household: FakeHousehold = {
      id: this.id('h'),
      name,
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
    }
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
          const issue = nameIssue('name', body.name)
          if (issue) return validationError([issue])
          const household = this.addHousehold((body.name as string).trim(), user.id)
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
    ]
  }
}

function publicUser(user: FakeUser) {
  return { id: user.id, email: user.email, name: user.name }
}

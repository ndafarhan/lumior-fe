# Design

## Context

The frontend foundation is in place (see the archived `frontend-foundation` change and the `api-client` and `app-shell` specs):

- `src/lib/api/client.ts` wraps openapi-fetch with `apiFetch`, which adds `X-Request-ID`, sends `credentials: "include"`, applies a 15 s timeout, and throws `ApiError`. TanStack Query retries only GETs on network, timeout, and 5xx failures.
- `src/app/routes.tsx` has one layout route (`AppLayout`) whose children are the MVP areas and a `*` not-found route, each with a `handle.title`.
- Code follows `routes -> features -> lib, components`. Features never import each other, and `lib` never imports features.
- Tests use MSW (`tests/msw/`) and `renderApp(path)` from `tests/render-app.tsx`. Requests without a handler fail the test.

The backend has no auth or household endpoints yet (see proposal.md - Why). It already provides the error envelope, `UnauthorizedError` (401, `unauthorized`), credentialed CORS for configured origins, and `operationId`s of the form `<module>_<action>`.

## Goals / Non-Goals

**Goals:**
- Define one HTTP contract that both repositories can build against independently.
- Keep token handling inside `lib/` so every feature gets authenticated requests without extra code.
- Give later features one place to read the active household and one query-key convention that is cleared when the household changes.

**Non-Goals:**
- Choosing the backend's token format, hashing, or storage. The frontend treats the access token as an opaque string.
- Proactive token refresh based on the token's expiry time. The frontend refreshes only on load and after a 401.
- Syncing sign-in (as opposed to sign-out) across tabs.

## Decisions

### 1. Proposed backend contract

The full backend-facing version, with validation limits, cookie and rotation behavior, authorization rules, and every error code, is in `contracts/auth-and-households.md`. This section summarizes it.

All bodies are JSON. Errors use the existing envelope. `Session` is `{access_token: string, token_type: "bearer", expires_in: int, user: User}`, `User` is `{id, email, name}`, and `Household` is `{id, name, role: "owner"|"member", member_count}`.

| Method & path | operationId | Body | Success | Notable errors |
| --- | --- | --- | --- | --- |
| `POST /api/v1/auth/register` | `auth_register` | `{name, email, password}` | 201 `Session` + refresh cookie | 409 `email_taken`, 422 |
| `POST /api/v1/auth/login` | `auth_login` | `{email, password}` | 200 `Session` + refresh cookie | 401 `invalid_credentials` |
| `POST /api/v1/auth/refresh` | `auth_refresh` | none (cookie) | 200 `Session` + rotated cookie | 401 `invalid_refresh_token` |
| `POST /api/v1/auth/logout` | `auth_logout` | none (cookie) | 204, cookie cleared | none |
| `GET /api/v1/me` | `identity_get_me` | | 200 `User` | 401 |
| `PATCH /api/v1/me` | `identity_update_me` | `{name}` | 200 `User` | 422 |
| `POST /api/v1/me/password` | `identity_change_password` | `{current_password, new_password}` | 204 | 400 `invalid_current_password`, 422 |
| `GET /api/v1/households` | `households_list` | | 200 `Household[]` (oldest membership first) | |
| `POST /api/v1/households` | `households_create` | `{name}` | 201 `Household` | 422 |
| `PATCH /api/v1/households/{id}` | `households_update` | `{name}` | 200 `Household` | 403 `owner_required`, 403 `not_a_member`, 404 `household_not_found` |
| `GET /api/v1/households/{id}/members` | `households_list_members` | | 200 `{user_id, name, email, role}[]` | 403 `not_a_member`, 404 |
| `DELETE /api/v1/households/{id}/members/{user_id}` | `households_remove_member` | | 204 | 403 `owner_required`, 409 `owner_cannot_leave` |
| `POST /api/v1/households/{id}/invites` | `households_create_invite` | | 201 `{code, expires_at}` | 403 `owner_required` |
| `GET /api/v1/invites/{code}` | `households_get_invite` | | 200 `{household_id, household_name, invited_by, expires_at, already_member}` | 404 `invite_not_found`, 410 `invite_expired`, 410 `invite_used` |
| `POST /api/v1/invites/{code}/accept` | `households_accept_invite` | | 200 `Household` | 404, 410, 409 `already_member` |

Leaving a household is `DELETE .../members/{own user_id}`. The refresh cookie is `httpOnly`, `Secure` outside local development, `SameSite=Lax`, and scoped to `Path=/api/v1/auth`. Login, register, and refresh all return the full `Session`, including `user`, so restoring the session takes one request.

*Alternative:* return only the token from refresh and call `GET /me` afterwards. That costs a second request on every page load.

### 2. Session state lives in `lib/auth`

`apiFetch` lives in `lib` and must add the token, so the token holder cannot live in a feature. `src/lib/auth/session.ts` is a small store that holds the in-memory access token and the current user, runs a single-flight `refresh()` (concurrent callers await the same promise), and notifies subscribers on `signed-in` and `signed-out`. `createApiClient(baseUrl, session)` passes the store to `apiFetch`.

`features/auth` owns the pages, forms, and React bindings (`SessionProvider`, `useSession`), and treats the store as the source of truth.

*Alternative:* keep the token in React state and inject it through context into each query. That cannot cover the single-flight refresh inside `fetch`, and it re-renders the tree on every refresh.

### 3. 401 handling inside `apiFetch`

`apiFetch` clones the request before sending it, so the body can be sent again. If the response is 401, the request carried a token, and the path is not under `/api/v1/auth/`, it awaits `session.refresh()` and resends the clone once with the new token. A failed refresh ends the session (`signed-out` with reason `expired`) and rethrows the original 401 `ApiError`. The resend happens below TanStack Query, so the retry policy in `query-client.ts` does not change.

### 4. Startup and routing

`SessionProvider` calls `refresh()` once on mount. Its status is `loading`, `signed-in`, `signed-out`, or `unreachable` (a network or timeout failure). While loading, the app shows a full-screen loader. `unreachable` shows a "Cannot reach the server" screen with "Try again".

Route tree:

```
/login, /register            PublicOnlyRoute (redirects signed-in users to "/")
RequireSession               (redirects to /login?next=<path+search>)
├── /invite/:code            no layout
├── /welcome                 onboarding, no layout
└── RequireHousehold         (redirects to /welcome?next=… when the user has no households)
    └── AppLayout
        ├── existing areas, /account, /household
        └── *                not-found
```

`next` is accepted only when it starts with a single `/`. Anything else falls back to `/`. On an expired session, the app navigates to `/login?next=<current>&reason=expired`.

### 5. Active household

`features/households` provides `HouseholdProvider` and `useActiveHousehold()`. It loads `GET /households`, keeps the active ID in localStorage under `lumior.activeHousehold.<userId>` (an ID, not a credential), and falls back to the first household. Household-scoped queries in later features use keys starting with `['household', householdId, ...]`. On a switch, the provider removes queries under the previous household's prefix. On sign-out, the whole query cache is cleared.

Losing access: `HouseholdProvider` subscribes to the query cache and the mutation cache and watches for failures with `ApiError` codes `not_a_member` and `household_not_found`. It handles them by refetching the list, dropping cached data of households that are gone, and showing a notice. The active household then falls back to the first remaining one, or to onboarding. Subscribing in the provider, rather than adding `onError` hooks in `createQueryClient`, keeps the behavior with any `QueryClient`, including the ones tests create. `owner_required` is not a loss of access. It shows the permission message and refetches members.

*Alternative:* put the household in the URL (`/h/:id/budgets`). Links would then identify the household, but every route in the `app-shell` spec would change and the not-found and title logic would need rework. Not worth it for the MVP.

### 6. Cross-tab sign-out

The session store posts `signed-out` on a `BroadcastChannel('lumior-session')`, and other tabs end their session locally when they receive it. Browsers without `BroadcastChannel` skip this. All target browsers in `browserslist` support it.

### 7. Types from a draft contract

`contracts/openapi.json` is the foundation's OpenAPI document plus the paths above. `OPENAPI_SOURCE=contracts/openapi.json npm run api:generate` produces `schema.d.ts`. When `lumior-be` publishes the real document, `api:generate` runs against it again and the draft is deleted. Any mismatch shows up as type errors.

### 8. Forms and UI

Forms use controlled inputs with zod schemas, mapping `ApiError.fieldErrors` onto fields. No form library is added. New shadcn/ui components are added through the shadcn CLI: `label`, `dropdown-menu`, and `alert-dialog`. They are built on the existing `radix-ui` package.

### 9. Test support

`tests/msw/fake-backend.ts` is an in-memory implementation of the contract (users, sessions, households, members, invites) with a `reset()` that runs between tests. `renderApp(path, { session })` defaults to a signed-in user with one household, so existing shell tests keep working. `session: null` starts signed out.

The same fake backend drives a development mock mode: with `VITE_API_MOCKING=true`, `main.tsx` starts the MSW browser worker before rendering. The import is dynamic and gated on `import.meta.env.DEV`, so no mock code reaches production builds. This lets the app be exercised end to end before `lumior-be` implements the contract.

## Risks / Trade-offs

- [The backend implements a different contract] → The draft lives in `contracts/openapi.json` and is linked from the backend change. Regenerating types from the real document turns any difference into compile errors.
- [Refresh-token rotation races when two tabs refresh at the same moment, so one tab sees `invalid_refresh_token`] → Ask the backend to accept the just-rotated token for a short grace period (for example 30 s). The frontend refreshes only on load and after a 401, which keeps races rare.
- [In production, the frontend and backend are on different sites, so the `SameSite=Lax` cookie is not sent] → Recorded as a deployment requirement in the proposal. With different sites the backend must use `SameSite=None; Secure`, which needs CSRF protection on `/auth/refresh` and `/auth/logout`.
- [Access token held only in memory: every page load costs one refresh request] → An accepted trade-off for not storing tokens in scriptable storage.
- [localStorage unavailable (private mode)] → Reads and writes are wrapped. Without storage, the first household is selected after each load.

## Migration Plan

No user data exists yet. Deploy the frontend only together with or after the backend `auth-and-households` change. Rollback means redeploying the previous frontend build, which does not call the new endpoints.

## Open Questions

- Invite lifetime and access-token lifetime are backend settings. The frontend shows `expires_at` and reacts to 401, so their values do not affect this design.

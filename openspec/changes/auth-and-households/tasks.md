# Tasks

## 1. Contract and test backend

- [ ] 1.1 Write `contracts/openapi.json` (foundation document plus every path, schema, and error code in design.md §1), generate `src/lib/api/schema.d.ts` with `OPENAPI_SOURCE=contracts/openapi.json npm run api:generate`, and document the draft-contract workflow in README.md "API types"; verify `npm run typecheck` passes and the generated types contain `auth_login` and `households_accept_invite`
- [ ] 1.2 Build `tests/msw/fake-backend.ts`, an in-memory implementation of the contract (users, refresh cookie and rotation, access tokens, households, members, invites with expiry and use) that resets between tests; verify unit tests for login/refresh/logout, `email_taken`, `owner_required`, `not_a_member`, `invite_expired`, and `already_member`
- [ ] 1.3 Add the development mock mode (`VITE_API_MOCKING=true` starts the MSW browser worker with the fake backend, dynamically imported only when `import.meta.env.DEV`; `npx msw init public/`), document it in README.md and `.env.example`; verify `npm run dev` with the flag serves `/api/v1/auth/login` from the mock, and `npm run build` output contains no `fake-backend` code
- [ ] 1.4 Add shadcn/ui `label`, `dropdown-menu`, and `alert-dialog` through the shadcn CLI; verify `npm run lint` and `npm run typecheck` pass

## 2. Session core and API client

- [ ] 2.1 Implement `src/lib/auth/session.ts`: in-memory token and user, single-flight `refresh()`, `signIn`/`signOut` with reason, subscriber notifications, and `BroadcastChannel('lumior-session')` sign-out; verify unit tests for concurrent refresh sharing one call, a failed refresh signing out with reason `expired`, and a sign-out message from another channel instance signing out locally
- [ ] 2.2 Extend `apiFetch`/`createApiClient` to add `Authorization: Bearer` when signed in (never on `/api/v1/auth/*`), clone the request, and on 401 refresh once and resend once; verify MSW tests for the header present/absent, GET and POST resent after refresh, three parallel 401s causing one refresh, a second 401 not refreshing again, and a failed refresh rethrowing the original 401
- [ ] 2.3 Update README.md "Calling the API" with the auth behavior (token header, refresh on 401, write resend); verify the text matches the `api-client` delta spec

## 3. Sign-in, registration, and route protection

- [ ] 3.1 Add `features/auth` with `SessionProvider` (startup refresh; `loading`/`signed-in`/`signed-out`/`unreachable`) and `useSession`, mounted in `app/providers.tsx`, plus the full-screen loader and "Cannot reach the server" screen with "Try again"; verify tests for reload with a valid cookie, a 401 on startup, and a network failure on startup
- [ ] 3.2 Restructure `app/routes.tsx` into `PublicOnlyRoute`, `RequireSession`, and `RequireHousehold` (design §4) with a safe `next` parameter; update `renderApp(path, { session })` to default to a signed-in user with one household; verify the existing shell tests still pass, a signed-out visit to `/budgets?month=2026-10` lands on `/login` and returns there after sign-in, `next=https://evil.example` and `next=//evil.example` fall back to `/`, and a signed-in visit to `/login` goes to `/`
- [ ] 3.3 Build the `/login` page (zod validation, `invalid_credentials` message, keep email/clear password, session-expired notice from `reason=expired`, link to register that keeps `next`); verify tests for every `user-session` sign-in scenario and the expired-session scenario
- [ ] 3.4 Build the `/register` page (name/email/password rules, `email_taken` with sign-in link, 422 field mapping, sign in on success); verify tests for every `user-account` registration and validation scenario
- [ ] 3.5 Add a test that after sign-in and after registration no token, refresh token, or password appears in localStorage, sessionStorage, or `document.cookie`; verify it passes and fails if the token is written to localStorage

## 4. Households

- [ ] 4.1 Add `features/households` with `HouseholdProvider`/`useActiveHousehold` (list query, per-user remembered ID with storage errors ignored, fallback to first, switch that removes `['household', previousId]` queries); verify tests for remembered selection, a stale remembered ID, two users on one device, and switching that drops the previous household's cached data
- [ ] 4.2 Build the `/welcome` onboarding page with the create-household form and invite-link explanation, returning to `next` after creation; verify tests for the onboarding and create-household scenarios, including the blank-name case
- [ ] 4.3 Add the access-loss handling (`QueryCache`/`MutationCache` `onError` emitting on `not_a_member`/`household_not_found`; provider refetches, reselects, and shows "You no longer have access to <name>"); verify a test where a request returns 403 `not_a_member` and the app switches households or shows onboarding
- [ ] 4.4 Build the `/household` settings page: members with roles and "You", owner-only rename and remove (with `alert-dialog` confirmation), member-only leave, and the `owner_required` message with member refetch; verify tests for every membership scenario in the `households` spec
- [ ] 4.5 Add invite creation on `/household` (link built from `window.location.origin`, expiry shown, copy to clipboard); verify a test that the shown link is `<origin>/invite/<code>` and "Copy link" writes it to the clipboard
- [ ] 4.6 Build the `/invite/:code` page (preview, Join/Cancel, already-member switch, `invite_not_found`/`invite_expired`/`invite_used` messages); verify tests for every invite scenario, including a signed-out visitor who registers and comes back to the invite

## 5. Shell and account

- [ ] 5.1 Add the household switcher (active name, other households, "Create household", "Household settings") and the account menu (name, "Account settings", "Sign out") to the sidebar and the narrow-width menu sheet; verify tests at desktop and 800 px widths and a sign-out test that also covers a failing logout request
- [ ] 5.2 Add a cross-tab test: two session instances share a channel, and signing out in one shows the sign-in page in the other; verify it passes
- [ ] 5.3 Build the `/account` page: email shown, display-name change that updates the account menu without reload, and password change (`invalid_current_password` on its field, fields cleared on success, still signed in); verify tests for every `user-account` settings scenario
- [ ] 5.4 Add `handle.title` values for the new pages and update README.md "Layout" with `features/auth`, `features/households`, `lib/auth`, and the `['household', id, ...]` query-key rule; verify the title tests cover `/account` ("Account · Lumior") and `/household`

## 6. Integration check

- [ ] 6.1 Run `npm run lint`, `format:check`, `typecheck`, `test`, and `build`, and walk through the app in the dev server with MSW running in the browser against the fake backend: register, create two households, switch, invite and join from a second browser profile, remove a member, change name and password, sign out in one tab and confirm the other tab follows; verify every command passes and every step behaves as specified

## Workflow follow-up

- Share `contracts/auth-and-households.md` and `contracts/openapi.json` with the `lumior-be` `auth-and-households` change so the backend implements the same contract. Keep both in sync if the contract changes.
- When the backend publishes the contract, regenerate types from it, delete `contracts/openapi.json`, run the same walkthrough against a real `lumior-be`, and confirm there are no CORS or cookie errors.
- Archive the change after review.

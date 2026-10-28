# Proposal

## Why

Every planned Lumior feature (budgets, expenses, catalog, shopping lists, optimization) belongs to a household and is used by a signed-in person. Right now the frontend has no notion of users or households, and anyone who opens the app sees every area. Accounts, sessions, and households need to exist before any feature that stores household data can be built. This is the second step in the frontend sequence, after `frontend-foundation`.

The backend (`lumior-be`) has not built its own `auth-and-households` change yet. Its foundation leaves token transport open and only keeps CORS compatible with cookie-based refresh tokens. So this change also proposes the HTTP contract the frontend needs (see design.md). The frontend is built and tested against that contract using MSW mocks, and the backend change implements the same contract.

## What Changes

- Add registration, sign-in, and sign-out pages.
- Keep the session with a short-lived access token held only in memory and a refresh token in an httpOnly cookie set by the backend. Restore the session on page load, refresh it when an API call returns 401, and end it cleanly when refreshing fails.
- Require sign-in for every app area. A signed-out visitor is sent to the sign-in page and returned to the page they asked for after signing in.
- Add an account settings page for changing the display name and the password.
- Add households: create one, list the ones the user belongs to, switch the active household from the shell, rename it (owner only), see its members, remove a member (owner only), and leave it (members only).
- Add invitations: an owner creates an invite link, and a signed-in user who opens the link can see which household it is for and join it.
- Send users who belong to no household to an onboarding page where they create one or are told to use an invite link.
- Add the proposed auth and household endpoints to a draft OpenAPI document in this repo and generate API types from it until the backend publishes the real document.

Out of scope: email verification, password reset, deleting a household, transferring ownership, roles other than owner and member, social sign-in, and any feature data (budgets and so on).

## Capabilities

### New Capabilities

- `user-session`: Signing in and out, keeping and restoring the session, refreshing the access token, ending an expired session, and restricting app areas to signed-in users.
- `user-account`: Registering an account and managing it afterwards: display name and password.
- `households`: Creating and listing households, choosing the active household, membership (members, owner-only actions, leaving), and joining through invitations.

### Modified Capabilities

- `api-client`: Authenticated requests carry the access token, and a 401 response triggers one token refresh and one retry of the original request, including write requests.
- `app-shell`: The layout and its areas are shown only to signed-in users, and the shell gains the household switcher and the account menu.

## Impact

- **Code**: New `src/features/auth`, `src/features/account`, and `src/features/households`; new routes for sign-in, registration, account settings, household settings, onboarding, and invitations; changes to `src/lib/api/client.ts` (token header and refresh), `src/app/routes.tsx` (public and protected routes), `src/app/layout/` (switcher and account menu), and `tests/msw/handlers.ts` (default signed-in session).
- **API contract**: Proposes new backend endpoints under `/api/v1/auth`, `/api/v1/me`, `/api/v1/households`, and `/api/v1/invites` (listed in design.md). `lumior-be` needs a matching `auth-and-households` change before this frontend works against a real backend. Until then, `src/lib/api/schema.d.ts` is generated from the draft document `contracts/openapi.json`.
- **Backend configuration assumptions**: The refresh cookie must reach the backend from the frontend origin. In local development, `localhost:5173` and `localhost:8000` are the same site, so `SameSite=Lax` works. In production, the frontend and backend must be served from the same site (for example `app.example.com` and `api.example.com`).
- **Dependencies**: None new. Forms use the existing zod and shadcn/ui components.
- **Later changes**: Feature areas (`budgets-and-expenses` onward) read the active household from the context added here.

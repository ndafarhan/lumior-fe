# lumior-fe

Web frontend for Lumior, a household budgeting and grocery price optimization app. It is a
desktop-first React single-page app that talks to the [`lumior-be`](../lumior-be) FastAPI backend
over its versioned HTTP API (`/api/v1`).

## Requirements

- Node.js 22 (see `.nvmrc`) and npm
- A running `lumior-be` for local development (see its README)

## Local setup

```bash
nvm use                      # Node 22
npm ci                       # install exact dependencies from package-lock.json
cp .env.example .env.local   # local configuration
npm run dev                  # http://localhost:5173
```

The backend must allow the dev server's origin. `lumior-be`'s `.env.example` already contains:

```
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

If the backend is not running, the app still loads and shows a "Server unavailable" banner.

### Configuration

Settings are read at build time from `VITE_*` environment variables (`.env.local` in development)
and validated at startup. An invalid value shows a configuration error screen instead of the app.

| Variable            | Example                 | Notes                                                     |
| ------------------- | ----------------------- | --------------------------------------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend origin, required. API calls go to `<this>/api/v1` |
| `VITE_API_MOCKING`  | `true`                  | Development only: serve the API from the mock (below)     |

### Mock mode (no backend)

With `VITE_API_MOCKING=true` in `.env.local`, `npm run dev` starts an MSW service worker
(`public/mockServiceWorker.js`) that answers API calls from the in-memory fake backend in
`tests/msw/fake-backend.ts`, the same one the tests use. Sign in as `demo@lumior.test` /
`password123`. Mock data is kept in `localStorage` (`lumior.mock.state`); remove that key to start
over. Production builds never include the mock: it is imported only when `import.meta.env.DEV` is
true.

## Scripts

| Command                | What it does                                             |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | Vite dev server with hot reload                          |
| `npm run build`        | Type check and production build into `dist/`             |
| `npm run preview`      | Serve the production build locally                       |
| `npm test`             | Run all tests once (Vitest, jsdom)                       |
| `npm run test:watch`   | Run tests in watch mode                                  |
| `npm run typecheck`    | TypeScript in strict mode                                |
| `npm run lint`         | ESLint                                                   |
| `npm run format`       | Format with Prettier (`format:check` only checks)        |
| `npm run api:generate` | Regenerate API types from the backend's OpenAPI document |

CI (`.github/workflows/ci.yml`) runs lint, format check, type check, tests, and build on every
push and pull request.

## API types

Request and response types come from the backend's OpenAPI document and are committed in
`src/lib/api/schema.d.ts`, so builds and CI do not need a running backend. Regenerate them
whenever the backend API changes:

```bash
npm run api:generate                                     # from http://localhost:8000
API_URL=https://api.example.com npm run api:generate     # from another backend
OPENAPI_SOURCE=./openapi.json npm run api:generate       # from a file
```

A backend change that breaks the frontend then shows up as a `npm run typecheck` error.

### Draft contracts

When the frontend needs endpoints the backend has not built yet, the proposed contract lives in
`contracts/`: a readable version for the backend team (`contracts/auth-and-households.md`) and
an OpenAPI document (`contracts/openapi.json`). The committed types are generated from the draft
until the backend publishes the real document:

```bash
OPENAPI_SOURCE=contracts/openapi.json npm run api:generate
```

Once `lumior-be` implements the contract, run `npm run api:generate` against it, fix any type
errors, and delete the draft.

## Layout

```
src/
  main.tsx          entry: validates config, starts the dev mock if enabled, renders the app
  app/              providers, router, route guards, layout, error page, document title
  routes/           one thin page component per area
  features/<name>/  API hooks, components, and schemas for one area
    auth/           session restore, sign-in and registration pages, sign-out
    account/        account settings (display name, password)
    households/     households list, active household, settings, invites
  components/       shared components; ui/ holds shadcn/ui primitives
  lib/
    api/            typed client, ApiError, retry policy, health check, generated schema
    auth/           in-memory session store, session hooks, account field rules
    money/          money formatting and input parsing
    config.ts       environment validation
    forms.ts        zod and API errors mapped onto form fields
tests/              test setup, MSW fake backend and handlers, render helpers
contracts/          draft API contracts the backend has not published yet
```

### Routes and guards

```
/login, /register              public only (a signed-in user is sent on)
everything else                needs a session (signed-out visitors go to /login?next=...)
  /welcome, /invite/:code      no household needed, no sidebar
  app areas, /household, /account, not found
                               need an active household (otherwise /welcome)
```

### Households

Every signed-in page can read the active household with `useActiveHousehold()` from
`features/households/context`. Data that belongs to one household must use a query key that
starts with `householdKey(householdId)` (`['household', id, ...]`): switching households removes
those queries, so one household's data never shows up in another. Requests that fail with
`not_a_member` or `household_not_found` make the app reload the list and choose another household.

### Dependency rule

```
routes -> features -> lib, components
```

- Features never import from other features. Code two features need moves to `lib/` or
  `components/`.
- A feature mirrors a backend module: `features/budgets` talks to `modules/budgets`.

### Calling the API

- Use the typed client from `useApi()` inside TanStack Query hooks:

  ```ts
  const { client } = useApi()
  useQuery({
    queryKey: ['budgets'],
    queryFn: async ({ signal }) => (await client.GET('/api/v1/budgets', { signal })).data,
  })
  ```

- Every failed call throws an `ApiError` with `kind` (`http`, `network`, `timeout`), `status`,
  `code`, `message`, `details`, and `requestId`. Use `error.fieldErrors` to show validation
  errors next to form fields, and `userMessageFor(error)` for user-facing text.
- Each request carries a fresh `X-Request-ID`, times out after 15 seconds, and is sent with
  credentials. Failed GET requests are retried up to twice on network errors, timeouts, and 5xx
  responses. Writes are never retried automatically.
- While the user is signed in, requests carry `Authorization: Bearer <access token>` (never
  requests to `/api/v1/auth/*`). The token lives only in memory (`src/lib/auth/session.ts`); the
  refresh token is an httpOnly cookie set by the backend. When a request gets 401, the client
  refreshes the token once (parallel requests share one refresh) and sends the request once more,
  writes included, because the backend rejected it before doing anything. If the refresh is
  rejected, the session ends and the user sees the sign-in page.

### Money

- The API sends money as `{"amount": "12500.00", "currency": "IDR"}`. Keep amounts as strings:
  never call `Number()`, `parseFloat`, or unary `+` on them (ESLint enforces this in the money
  code).
- Display with `<Money value={...} />` or `formatMoney()`. Read user input with `<MoneyInput>` or
  `parseAmountInput()`, and send it with `toMoneyPayload()`.
- Decimal places per currency come from `src/lib/money/currency.ts`, which mirrors
  `CURRENCY_PRECISION` in `lumior-be`. Update both when adding a currency.

## Tests

Tests run in jsdom with Testing Library. MSW (`tests/msw/`) simulates the backend: every test gets
a healthy `/health/ready`, and tests add their own handlers with `server.use(...)`. Requests
without a handler fail the test. Use `renderApp(path)` from `tests/render-app.tsx` to render the
real routes with test providers.

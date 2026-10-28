# Design

## Context

The repository has no application code (see proposal.md - Why). The backend contract this frontend builds on is fixed by `lumior-be`'s `project-foundation` change and was checked against its code:

- Business routes live under `/api/v1`. The OpenAPI document is at `/api/v1/openapi.json`, and operation IDs follow `<module>_<function>`. It has no business paths yet, so the generated types are almost empty until `auth-and-households` lands.
- Every non-2xx response has the body `{"error": {"code", "message", "details", "request_id"}}`. Each validation detail is `{"location": [...], "reason", "type"}`, where `location` starts with the input source (for example `["body", "name"]`).
- CORS allows credentials, echoes the request headers, and exposes `X-Request-ID`. `http://localhost:5173` is in the default allow-list.
- `/health/ready` sits outside `/api/v1` and is excluded from the OpenAPI document. It returns `{"status": "ok"|"unavailable", "checks": {...}}` with HTTP 200 or 503.
- Money is `{"amount": "<decimal string>", "currency": "<ISO 4217>"}`. The backend already rounds the amount to the currency's precision (for example IDR 2, JPY 0).

```
 Browser (desktop)                                      lumior-be
 +-----------------------------------------------+      +--------------------+
 |  React SPA (Vite build, static files)         |      |  FastAPI           |
 |  routes/  --> features/* (later changes)      |      |                    |
 |     |            |                            |      |  /api/v1/...       |
 |     v            v                            | HTTP |  /api/v1/openapi   |
 |  TanStack Query --> api client (openapi-fetch)|----->|  /health/ready     |
 |                     + error mapping           |<-----|                    |
 |                     + X-Request-ID, timeout   | JSON +--------------------+
 +-----------------------------------------------+
          ^ types generated from openapi.json (committed)
```

## Goals / Non-Goals

**Goals:**
- One way to call the API, one error type, and one way to show money. No per-feature variations.
- A folder layout where each later feature (auth, budgets, catalog, lists, optimization) is self-contained.
- Contract drift with the backend is caught by `tsc` in CI, not by users.
- Tests run without a real backend.

**Non-Goals:**
- Authentication, token refresh, and route guards (`auth-and-households`).
- Mobile layouts and PWA/offline support (desktop web was chosen; narrow widths only need to stay usable).
- Internationalization. The UI is English-only, and no i18n framework is added yet.
- Production hosting and deployment pipeline.
- End-to-end browser tests against a running backend (added when the first real feature exists).

## Decisions

### 1. React 19 + TypeScript + Vite single-page app

A client-rendered SPA served as static files. The backend is a separate FastAPI service, so a server-rendering framework would add a second server without a clear benefit for an authenticated desktop app with no SEO needs.

*Alternatives:* Next.js (SSR and RSC are unnecessary here, and it needs a Node runtime plus a BFF decision for cookies); Vue (chosen against by the user).

### 2. Feature-first folder layout

```
src/
  main.tsx            entry: config check, providers, router
  app/                providers, router definition, layout, error boundary, not-found
  routes/             one file per area page (thin; delegates to features)
  features/<name>/    api hooks, components, schemas for one area (from later changes)
  lib/
    api/              client, error types, generated schema.d.ts, health check
    money/            format and parse helpers
    config.ts         env parsing and validation
  components/ui/      shadcn/ui primitives (copied into the repo)
tests/                test setup, MSW handlers
```

Rule: `routes -> features -> lib`. Features never import from other features; shared code moves to `lib/` or `components/`. This mirrors the backend's modules, so `features/budgets` lines up with `modules/budgets`.

*Alternative:* layer-first layout (`hooks/`, `services/`, `pages/`). It hides feature boundaries as the app grows.

### 3. Typed client: openapi-typescript + openapi-fetch

`npm run api:generate` runs `openapi-typescript` against `${API_URL}/api/v1/openapi.json` (or a local file) and writes `src/lib/api/schema.d.ts`, which is committed. `openapi-fetch` gives typed `GET/POST/...` calls keyed by path with no runtime codegen. A thin wrapper around it adds:

- base URL `${VITE_API_BASE_URL}/api/v1` and `credentials: "include"`
- an `X-Request-ID` header (`crypto.randomUUID()`) on each request
- a 15 s timeout via `AbortSignal.timeout`, merged with any caller signal
- mapping of failures to one `ApiError` class with `kind: "http" | "network" | "timeout"`, plus `status`, `code`, `message`, `details`, and `requestId`. An envelope body is used when present; otherwise the error code is `http_error` and the request ID comes from the response header.

The generated file is committed so that builds and CI do not need a running backend. A CI step that regenerates against the backend and diffs the result can be added once both run together in CI.

*Alternatives:* orval or openapi-generator (heavier output, and they generate hooks we would rather write per feature); hand-written types (drift silently).

### 4. Server state with TanStack Query; no global client store

All backend data goes through TanStack Query. The default `retry` function implements the spec rule: up to 2 retries only for `GET` requests that fail with network, timeout, or 5xx errors. Mutations never retry. Local UI state stays in components. No Redux or Zustand until a need appears.

*Alternative:* SWR (fewer features for mutations and retries); RTK Query (brings Redux).

### 5. Routing with React Router 8 (data router, library mode)

`createBrowserRouter` with one layout route, child routes for `/`, `/budgets`, `/expenses`, `/catalog`, `/shopping-lists`, and `/optimize`, a `*` not-found route, and an `errorElement` on the layout's outlet so errors replace only the content area. Each route's `handle` carries its title, which a small hook writes to `document.title`.

*Alternative:* TanStack Router (stronger type-safe params, but more setup). Its benefit is small while routes are this simple.

### 6. UI: Tailwind CSS 4 + shadcn/ui

shadcn/ui components are copied into `components/ui/`, so they are owned and editable. They are built on Radix for accessibility. The layout uses a fixed sidebar at `lg` (1024 px) and above, and a `Sheet` toggled from a top bar below that. Icons come from `lucide-react`.

### 7. Configuration validated at startup with zod

`lib/config.ts` parses `import.meta.env` with zod (`VITE_API_BASE_URL` must be an absolute http(s) URL). On failure `main.tsx` renders a static configuration error screen instead of the app and sends no requests. `.env.example` documents `VITE_API_BASE_URL=http://localhost:8000`.

*Alternative:* the Vite dev proxy with relative `/api` URLs. It hides CORS problems in development that would then appear in production, and the backend already allows the dev origin.

### 8. Money without floats: Intl.NumberFormat on strings

- **Precision**: decimal places come from a copy of the backend's `CURRENCY_PRECISION` table (`lib/money/currency.ts`), not from the browser. CLDR, which `Intl` uses, gives IDR 0 decimals while Lumior stores and returns 2, so relying on `Intl` defaults would round `"123456789012.35"` to `IDR 123,456,789,012`. Currencies missing from the table fall back to the `Intl` default. The two tables must be kept in sync.
- **Display**: `Intl.NumberFormat("en-US", {style: "currency", currency, minimumFractionDigits, maximumFractionDigits})` formats a decimal *string* exactly (supported in current Chrome, Firefox, Safari, and Edge), so no `Number()` conversion is needed. The minimum is the currency precision, and the maximum is never below the number of decimals in the amount, so no digit is rounded away. Formatters are cached. An invalid amount or an unknown currency returns `—`.
- **Input**: a pure `parseAmountInput(text, currency, {allowNegative})` strips `,` separators, checks the value with a regex, checks decimal places against the currency precision above, and returns either `{ok: true, value: "12500"}` or an error message. A `MoneyInput` component wraps it for forms.
- **Arithmetic** (sums, differences) is not needed in this change. When a feature needs it, a decimal library (for example `big.js`) will be added in that change rather than speculatively now.

The digit grouping style (`12,500`, not the `12.500` used in Indonesian) follows the chosen English UI.

### 9. Backend availability via polling

A `useBackendHealth` query calls `GET ${base}/health/ready` (outside `/api/v1`, so it uses a direct fetch with a hand-written zod schema). It refetches every 60 s, and TanStack Query pauses interval refetching while the tab is hidden. It also refetches on window focus. A banner in the layout shows while the last result is a failure.

### 10. Tooling and tests

- Node 22 LTS (`.nvmrc`), npm with a committed `package-lock.json`.
- TypeScript `strict` plus `noUncheckedIndexedAccess`. ESLint flat config (typescript-eslint, react-hooks, jsx-a11y). Prettier.
- Vitest + jsdom + Testing Library. MSW handlers in `tests/` simulate backend responses, including error envelopes, 5xx, network failure, and slow responses with fake timers.
- Unit tests for config, the error mapping, retry policy, and money helpers. Component tests for the layout, navigation, not-found page, error boundary, and health banner.
- GitHub Actions: `npm ci`, `lint`, `typecheck`, `test`, `build` on every push and pull request.

## Risks / Trade-offs

- [`Intl.NumberFormat` string formatting is unavailable in an old browser, which would fall back to float conversion] → Target evergreen desktop browsers (Browserslist: last 2 versions). A unit test asserts exact digits for a 15-digit amount so a regression is caught.
- [Committed generated types drift from the live backend] → `api:generate` is documented in the README, and the backend publishes the source. Add a CI drift check once both repos run together.
- [`credentials: "include"` with CORS breaks if the backend allow-list is misconfigured] → The CORS failure surfaces as a network error with a clear message. The README lists the required backend `CORS_ALLOWED_ORIGINS` value.
- [Retrying on 5xx doubles load during a backend incident] → At most 2 retries, with TanStack Query's exponential backoff, and only for reads.
- [Health polling every 60 s per open tab] → The endpoint is cheap, polling pauses in hidden tabs, and the interval is one constant.

## Migration Plan

No existing frontend. Rollout is: merge the skeleton and run it locally against `lumior-be`. Hosting is decided in a later change. Rollback is reverting the commit.

## Open Questions

- Hosting target for the static build (for example Netlify, Vercel, Cloudflare Pages, or behind the backend's reverse proxy). This affects deployment only.
- Whether to add a CI job that regenerates API types against a backend container and fails on diff. This is useful once business endpoints exist.

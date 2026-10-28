# Proposal

## Why

Lumior is a household budgeting and grocery price optimization app. This repository (`lumior-fe`) is its web frontend and is currently empty. The backend (`lumior-be`) has finished its `project-foundation` change and now publishes a versioned API contract: `/api/v1`, a uniform error envelope, `X-Request-ID`, money as decimal strings, and an OpenAPI document. Every planned frontend feature needs the same groundwork on top of that contract: an application skeleton, a typed API client, consistent error and money handling, a navigation shell, and tooling. Building this once, before feature work, keeps the later frontend changes small and in step with the backend modules.

The planned frontend sequence follows the backend MVP order:

1. `frontend-foundation` (this change)
2. `auth-and-households` (login, registration, household selection)
3. `budgets-and-expenses` and `catalog-stores-prices`
4. `shopping-lists` (including "complete trip")
5. `basket-optimization`

## What Changes

- Create a desktop-first React + TypeScript single-page app built with Vite.
- Add environment-based configuration for the backend base URL, validated at startup.
- Add a typed API client generated from the backend's OpenAPI document. It parses the backend error envelope into one typed error, surfaces the request ID, and treats network failures and timeouts as distinct errors.
- Add the app shell: a desktop layout with sidebar navigation, routes for the planned MVP areas (shown as placeholders until their changes land), a not-found page, and an error boundary that shows the request ID for support.
- Show backend availability in the shell using the backend readiness endpoint.
- Add money display and input helpers that keep amounts as decimal strings and never convert them to floating-point numbers.
- Add developer tooling: package manager lockfile, strict TypeScript, ESLint and Prettier, Vitest with Testing Library and mock-service-worker API mocks, an OpenAPI type-generation script, and a CI pipeline.

No product features (auth, households, budgets, catalog, prices, lists, optimization) are part of this change.

## Capabilities

### New Capabilities

- `api-client`: How the frontend talks to the backend: configured base URL, typed requests from the OpenAPI document, mapping of the error envelope, network and timeout errors, and request ID propagation.
- `app-shell`: The application frame every feature plugs into: layout, navigation, routing, the not-found page, the error boundary, and the backend availability indicator.
- `money-format`: How monetary amounts from the API are displayed and how user-entered amounts are validated and sent back, without floating-point conversion.

### Modified Capabilities

None. No specs exist yet.

## Impact

- **Code**: New project skeleton under `src/` (app, routes, shared lib, API client), `tests/` setup, `package.json`, Vite, TypeScript, and lint configuration, and a CI workflow.
- **Dependencies**: React 19, React Router 8, TanStack Query 5, Tailwind CSS 4, shadcn/ui (Radix), openapi-fetch, openapi-typescript, zod; dev: Vitest, Testing Library, MSW, ESLint, Prettier.
- **Systems**: Needs a running `lumior-be` for local development. The backend's default `CORS_ALLOWED_ORIGINS` already includes `http://localhost:5173` (the Vite dev server).
- **Backend contract**: Read-only consumer of `/api/v1/openapi.json` and `/health/ready`. No backend change is required.
- **Assumptions**: The UI is English-only for now. The target currency is still open on the backend, so the frontend formats each amount with the currency it receives and has no hard-coded default currency.

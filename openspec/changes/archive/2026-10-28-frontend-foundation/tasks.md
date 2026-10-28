# Tasks

## 1. Project scaffolding and tooling

- [x] 1.1 Scaffold a Vite React + TypeScript project in the repo root (keeping `openspec/` and `.claude/`), add `.nvmrc` (Node 22), `.gitignore`, and a Browserslist of last 2 versions of evergreen desktop browsers; verify `npm run dev` serves the default page on `http://localhost:5173`
- [x] 1.2 Enable TypeScript `strict` and `noUncheckedIndexedAccess`, add the `@/` path alias to `src/`, and add a `typecheck` script; verify `npm run typecheck` passes
- [x] 1.3 Add ESLint flat config (typescript-eslint, react-hooks, jsx-a11y) and Prettier with `lint` and `format:check` scripts; verify both pass on the scaffold
- [x] 1.4 Install Tailwind CSS 4, initialize shadcn/ui (button, sheet, alert, card, input, separator), and add `lucide-react`; verify a shadcn `Button` renders styled in the dev server
- [x] 1.5 Set up Vitest with jsdom, Testing Library, jest-dom matchers, and MSW (`tests/setup.ts`, `tests/msw/server.ts`) with a `test` script; verify a trivial component test passes with `npm test`
- [x] 1.6 Create the folder layout from design.md (`app/`, `routes/`, `features/`, `lib/api/`, `lib/money/`, `components/ui/`) and remove the Vite demo content; verify `npm run build` succeeds

## 2. Configuration

- [x] 2.1 Implement `lib/config.ts` that parses `VITE_API_BASE_URL` with zod (absolute http(s) URL, trailing slash removed) and add `.env.example`; verify unit tests cover a valid URL, a missing value, and `not-a-url`
- [x] 2.2 Render a static configuration error screen from `main.tsx` when config parsing fails, naming the invalid setting and making no API requests; verify with a test that mounts the entry with an invalid env and asserts the message and zero fetch calls

## 3. API client

- [x] 3.1 Add `api:generate` (openapi-typescript from `${API_URL:-http://localhost:8000}/api/v1/openapi.json`, or a file path) writing `src/lib/api/schema.d.ts`, and commit the generated file from the current backend; verify the script runs against a local `lumior-be` and `npm run typecheck` passes
- [x] 3.2 Implement the `ApiError` class (`kind`: http/network/timeout, `status`, `code`, `message`, `details`, `requestId`) and the envelope parser with an `http_error` fallback that reads `X-Request-ID` from the response header; verify unit tests cover 404 envelope, 422 with field details, 502 HTML body, and an envelope missing fields
- [x] 3.3 Implement the openapi-fetch client wrapper: base URL `${VITE_API_BASE_URL}/api/v1`, `credentials: "include"`, a generated `X-Request-ID` per request, a 15 s timeout merged with any caller signal, and errors thrown as `ApiError`; verify MSW tests for the request ID header, credentialed mode, network failure → `network`, and a slow response → `timeout` (fake timers)
- [x] 3.4 Configure the TanStack Query client with the retry policy (at most 2 retries for GET on network/timeout/5xx; never for 4xx or mutations) and mount `QueryClientProvider` in `app/providers.tsx`; verify tests that a 503-then-200 GET succeeds, a 404 GET makes one call, and a failed POST makes one call
- [x] 3.5 Add a user-facing message helper that maps `ApiError` kinds to text (for example "Cannot reach the server" for network errors); verify unit tests for each kind

## 4. Money formatting and input

- [x] 4.1 Implement `formatMoney({amount, currency})` using cached `Intl.NumberFormat("en-US", {style: "currency"})` on the decimal string, returning `—` for an invalid amount or currency; verify unit tests for `IDR 12500.00`, `JPY 1500`, `USD -250.50`, `123456789012.35` exact digits, and `"abc"`
- [x] 4.2 Implement `parseAmountInput(text, currency, {allowNegative})` returning a normalized decimal string or an error message (letters, multiple decimal points, too many decimals for the currency, negative not allowed); verify unit tests covering every scenario in `specs/money-format/spec.md`
- [x] 4.3 Add a `Money` display component and a `MoneyInput` form component built on these helpers, and a `toMoneyPayload` helper producing `{amount: string, currency}`; verify component tests that invalid input shows the error message and that the submitted payload has a string amount
- [x] 4.4 Add a lint rule or unit test guard that `lib/money` never calls `Number(`, `parseFloat`, or unary `+` on amounts; verify it fails on a deliberately added `parseFloat` and passes after removal

## 5. App shell and routing

- [x] 5.1 Define the router (`createBrowserRouter`) with a layout route, child routes `/`, `/budgets`, `/expenses`, `/catalog`, `/shopping-lists`, `/optimize`, and a `*` not-found route, each with a `handle.title`; verify tests that each path renders its page title
- [x] 5.2 Build the desktop layout: a fixed sidebar at ≥1024 px with active-link styling, and a top bar with a `Sheet` menu below 1024 px; verify component tests for navigation without a full reload, the active link, and the menu showing all links at narrow width
- [x] 5.3 Add the `ComingSoon` placeholder page used by all MVP areas and a Dashboard placeholder; verify `/optimize` shows "Optimize" and the coming-soon message
- [x] 5.4 Add the not-found page inside the layout with a link to `/`; verify a test for `/does-not-exist`
- [x] 5.5 Add the content-area error boundary (`errorElement`) with a "Try again" action and the request ID reference for `ApiError`; verify tests that a throwing page shows the error page while sidebar links still work, and that an `ApiError` with request ID `r-42` shows `r-42`
- [x] 5.6 Add a `useDocumentTitle` hook driven by the route `handle`, producing "<Area> · Lumior"; verify a test that `/catalog` sets the title "Catalog · Lumior"

## 6. Backend availability

- [x] 6.1 Implement `useBackendHealth` (direct fetch of `${VITE_API_BASE_URL}/health/ready`, zod-validated, refetched every 60 s and on window focus, paused when hidden); verify MSW tests for 200 ok, 503 unavailable, and network failure
- [x] 6.2 Render the "server unavailable" banner in the layout while the last health result is a failure, removed when a check succeeds; verify a component test that moves from failure to success with fake timers and sees the banner disappear

## 7. Documentation and CI

- [x] 7.1 Write `README.md`: requirements, setup with `lumior-be` (including its `CORS_ALLOWED_ORIGINS`), scripts, `api:generate`, folder layout and the `routes -> features -> lib` rule, and the money rules; verify the setup steps work from a fresh clone
- [x] 7.2 Add `.github/workflows/ci.yml` running `npm ci`, `lint`, `format:check`, `typecheck`, `test`, and `build` on push and pull request; verify the workflow passes on a pushed branch

## 8. Integration check

- [x] 8.1 Run the app against a local `lumior-be`: navigate all areas, confirm there are no CORS errors in the console, stop the backend and confirm the unavailable banner appears, and restart it and confirm the banner clears

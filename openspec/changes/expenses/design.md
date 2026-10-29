# Design

## Context

The `auth-and-households` change is in place (see the `households`, `user-session`, and `api-client` specs):

- `useActiveHousehold()` from `features/households/context` gives every page inside the layout its household. Household data uses query keys starting with `householdKey(id)` (`['household', id, ...]`), and switching households removes those queries. Failures with `not_a_member` or `household_not_found` make the app reload the list and choose another household, wherever they happen.
- `src/lib/money` and `src/components/money` already format `{amount, currency}` values, parse typed amounts per currency (`parseAmountInput`, `MoneyInput`), and build request payloads (`toMoneyPayload`). Amounts stay decimal strings. ESLint forbids `Number()`/`parseFloat` on them.
- `src/routes/expenses.tsx` renders `ComingSoon`. `src/app/routes.tsx` lists the layout pages, each with a `handle.title`.
- `tests/msw/fake-backend.ts` implements the auth and household contract in memory and also drives the development mock mode (`VITE_API_MOCKING=true`).
- `lumior-be` has no expense module, and its `Household` has no currency (see proposal.md - Why). `CURRENCY_PRECISION` in `lumior-be` and `src/lib/money/currency.ts` list the supported currencies.

## Goals / Non-Goals

**Goals:**
- One HTTP contract for expenses, categories, and the household currency that both repositories build against independently.
- No monetary arithmetic in the frontend: every total comes from the backend.
- The month and the category filter live in the URL, so a view can be reloaded and linked.
- Categories are a separate resource that the later `budgets` change can use as is.

**Non-Goals:**
- Offline entry or optimistic updates. Changes appear after the backend confirms them.
- Charts. The per-category totals are a plain list for now.
- Searching or sorting by anything other than date.

## Decisions

### 1. Proposed backend contract

The full backend-facing version, with validation limits, ordering, pagination, migration, and every error code, is in `contracts/expenses.md`. Summary:

```jsonc
// Household (changed): gains currency
{ "id": "uuid", "name": "Rumah Bandung", "role": "owner", "member_count": 3, "currency": "IDR" }

// ExpenseCategory
{ "id": "uuid", "name": "Groceries", "archived": false }

// Expense
{ "id": "uuid", "amount": { "amount": "45000.00", "currency": "IDR" }, "spent_on": "2026-10-03",
  "category_id": "uuid", "note": "Weekly market", "created_at": "…Z", "updated_at": "…Z" }

// ExpensePage
{ "items": [Expense], "next_cursor": "opaque" | null }

// ExpenseSummary
{ "month": "2026-10", "total": Money, "categories": [{ "category_id": "uuid", "total": Money, "count": 2 }] }
```

All paths below are under `/api/v1/households/{household_id}`, except household creation.

| Method & path | operationId | Body / query | Success | Notable errors |
| --- | --- | --- | --- | --- |
| `POST /api/v1/households` (changed) | `households_create` | `{name, currency?}` (default `IDR`) | 201 `Household` | 422 |
| `GET /expense-categories` | `expenses_list_categories` | | 200 `ExpenseCategory[]` (all, by name) | |
| `POST /expense-categories` | `expenses_create_category` | `{name}` | 201 `ExpenseCategory` | 409 `category_name_taken`, 422 |
| `PATCH /expense-categories/{category_id}` | `expenses_update_category` | `{name?, archived?}` | 200 `ExpenseCategory` | 404 `category_not_found`, 409 `category_name_taken`, 422 |
| `GET /expenses` | `expenses_list` | `month` (required), `category_id?`, `cursor?`, `limit?` (default 50) | 200 `ExpensePage` | 422 |
| `POST /expenses` | `expenses_create` | `{amount, spent_on, category_id, note?}` | 201 `Expense` | 422 (`category_archived`, `currency_mismatch`, …) |
| `PATCH /expenses/{expense_id}` | `expenses_update` | any of the create fields | 200 `Expense` | 404 `expense_not_found`, 422 |
| `DELETE /expenses/{expense_id}` | `expenses_delete` | | 204 | 404 `expense_not_found` |
| `GET /expense-summary` | `expenses_get_summary` | `month` (required) | 200 `ExpenseSummary` | 422 |

Every path also returns 403 `not_a_member` and 404 `household_not_found`, exactly as the household endpoints do, so the existing access-loss handling covers expenses with no new code. Any member may use every endpoint. There is no owner-only action.

The summary is its own path (`/expense-summary`, not `/expenses/summary`), so it can never be confused with `/expenses/{expense_id}`.

*Alternative:* return the totals with the first page of `GET /expenses`. That ties totals to pagination and to the category filter, while the page needs the month total regardless of the filter.

*Alternative:* a category deletion endpoint. Deleting would orphan or delete past expenses and later budget history. Archiving keeps history intact and is the only removal offered.

### 2. Household currency is fixed at creation

`currency` is accepted only by `POST /households` and returned on every `Household`. `PATCH /households/{id}` does not accept it. Expenses are always in the household's currency, and the backend rejects any other currency with 422 `currency_mismatch`, so a sum is always in one currency and never needs conversion. The frontend reads the currency from `useActiveHousehold()` for `MoneyInput` and payloads. Existing households get `IDR` in the backend migration.

`CreateHouseholdForm` gains a currency field listing the codes from `CURRENCY_PRECISION`, defaulting to `IDR`. The settings page shows the currency as text.

*Alternative:* let the owner change the currency while the household has no expenses. That adds a state-dependent rule to the contract for a case that is rare in a new household. It can be added later without breaking anything.

### 3. Totals come from the backend

The month total and per-category totals come from `GET /expense-summary`. The frontend never adds amounts, which keeps the money rule (no floating point) without a decimal library. The category totals list uses the category names from the categories query, so a rename shows up without refetching the summary.

### 4. Month and filter in the URL

`useSearchParams` holds `month` (`YYYY-MM`) and `category` (a category id). An invalid or missing `month` means the current month. Dates are handled as `YYYY-MM-DD` strings throughout. "Today" and "current month" are computed once from the local calendar date (`getFullYear`/`getMonth`/`getDate`), never through `toISOString()`, which would shift the date across UTC midnight. Month labels ("October 2026") and dates in the list use `Intl.DateTimeFormat('en')` on a date built from the parts, with `timeZone: 'UTC'`, so the label never shifts.

Switching households clears `category`, because category ids belong to one household. The page watches the active household id and removes the parameter when it changes. The month is kept.

### 5. Queries, pagination, and invalidation

All keys start with `householdKey(householdId)`:

- `[..., 'expense-categories']`
- `[..., 'expenses', month, categoryId | null]`: `useInfiniteQuery`, `next_cursor` as the page parameter
- `[..., 'expense-summary', month]`

After creating, updating, or deleting an expense, the mutation invalidates `[..., 'expenses']` and `[..., 'expense-summary']` for the household, which covers both the old and the new month when an expense moves. Category mutations update the categories query in place. A 422 `category_archived` also invalidates the categories query, so the form stops offering the archived category. A 404 `expense_not_found` shows the message from the `expenses` spec and invalidates the list and the summary.

### 6. Feature layout and UI

```
src/features/expenses/
  api.ts                 types, query keys, list/summary/categories queries
  mutations.ts           create/update/delete expense, create/update category
  month.ts               month and date string helpers (parse, previous/next, today, labels)
  ExpensesView.tsx       month bar, summary, filter, list, "Load more"
  ExpenseForm.tsx        add/edit form inside a Sheet; delete with ConfirmButton
  CategoriesView.tsx     /expenses/categories
```

`routes/expenses.tsx` renders `ExpensesView`. A new `routes/expense-categories.tsx` renders `CategoriesView`, registered as `expenses/categories` with the title "Expense categories". The sidebar's "Expenses" `NavLink` already matches nested paths, so it stays active there.

The add and edit form opens in the existing `Sheet` component, so the list and its scroll position stay in place. The category field and the filter are native `<select>` elements and the date is a native `<input type="date">` with `max` set to today: they are accessible and simple to test, and need no new component. The amount uses `MoneyInput` with the household currency. A separate check rejects a parsed amount of zero, since `parseAmountInput` accepts `0`.

*Alternative:* a separate `/expenses/new` page. Leaving the list for every entry is slower when someone types in a whole receipt's worth of expenses.

### 7. Contract and types

`contracts/openapi.json` gains the paths and schemas above, and `Household` gains `currency`. `OPENAPI_SOURCE=contracts/openapi.json npm run api:generate` regenerates `schema.d.ts`. The backend-facing text is `contracts/expenses.md`, written in this change next to `contracts/auth-and-households.md`. A copy goes to `lumior-be/contracts/` when the backend change starts, as was done for auth and households.

### 8. Fake backend

`tests/msw/fake-backend.ts` gains `currency` on households, the nine default categories on every created household (including the seeded demo household), and expenses. Its summaries add amounts as `BigInt` values in the currency's minor units, using `CURRENCY_PRECISION`, and format the result back to a decimal string, so the fake never uses floating-point money either. Cursor pagination uses the index of the next item, encoded as a string. The dev mode already saves mock state in `localStorage` (`tests/msw/browser.ts`). Its loader fills in defaults for state saved before this change (households without a currency or categories, no expense list), so an existing mock session keeps working.

## Risks / Trade-offs

- [The backend implements a different contract] → Same mitigation as for auth and households: the draft lives in `contracts/`, and regenerating types from the real OpenAPI document turns differences into type errors.
- [Adding `currency` to `Household` breaks a backend that has already shipped households] → The field is additive in responses and optional in `POST /households`, so older clients keep working. The backend migration fills `IDR` for existing rows.
- [Time zones: a user late at night records "today", and the backend's UTC date is already tomorrow or still yesterday] → `spent_on` is a calendar date chosen by the user, not a timestamp. The contract asks the backend to reject only dates more than one day after its own UTC date, so a local "today" is always accepted.
- [Two members edit the same expense at once; the last save wins] → Accepted for the MVP. Expenses are small records, and the 404 handling covers the more confusing case of deletion.
- [A long month means many pages] → 50 expenses per page with "Load more". The totals do not depend on how many pages are loaded.

## Migration Plan

Deploy the frontend only together with or after the backend `expenses` change, which adds the household currency (filled with `IDR`), seeds the default categories for every existing household, and adds the endpoints. Rollback means redeploying the previous frontend build. It ignores the new `currency` field and never calls the new endpoints.

## Open Questions

- Whether the default category names should later be translated per user language. The names are ordinary rows that members can rename, so this does not change the contract or the frontend.

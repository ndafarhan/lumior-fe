# Tasks

## 1. Contract and test backend

- [x] 1.1 Add `currency` to `Household` and `currency?` to the `POST /api/v1/households` body in `contracts/openapi.json`, plus every expense, category, and summary path, schema, `operationId`, and error code from `contracts/expenses.md`; regenerate `src/lib/api/schema.d.ts` with `OPENAPI_SOURCE=contracts/openapi.json npm run api:generate`; verify `npm run typecheck` reports only the places that build a `Household` without `currency`, fix those, and confirm the generated types contain `expenses_list` and `expenses_get_summary`
- [x] 1.2 Extend `tests/msw/fake-backend.ts`: household currency (default `IDR`, unsupported code is 422), the nine default categories on every new household, category create/rename/archive with case-insensitive `category_name_taken`, expenses with the ordering, cursor pagination, filters, and validation rules in `contracts/expenses.md` (including `category_archived` only when the category changes, `currency_mismatch`, `expense_not_found` for another household's expense), and summaries summed as `BigInt` minor units; verify unit tests in `tests/msw/fake-backend.test.ts` for each of these, including a summary of `"0.10"` + `"0.20"` equal to `"0.30"`
- [x] 1.3 Make the dev mock state loader in `tests/msw/browser.ts` fill in defaults for state saved before this change (households without currency or categories, no expense list), and seed the demo household with a few expenses in the current month; verify a unit test that loads old-shaped state and lists the default categories, and that `npm run dev` with `VITE_API_MOCKING=true` shows the demo expenses
- [x] 1.4 Update the README "Draft contracts" section to list `contracts/expenses.md` next to `contracts/auth-and-households.md`; verify the paths named in the README exist

## 2. Household currency

- [x] 2.1 Add a currency field to `CreateHouseholdForm` (codes from `CURRENCY_PRECISION`, default `IDR`) and send it in `useCreateHousehold`; verify tests for the "Default currency" scenario (request body has `currency: "IDR"`) and for creating a household in SGD
- [x] 2.2 Show the currency as read-only text on `/household`; verify a test for the "View the currency" scenario and that no currency control is rendered

## 3. Expense data layer

- [x] 3.1 Add `src/features/expenses/month.ts`: parse and validate `YYYY-MM`, previous/next month, today's local date as `YYYY-MM-DD`, the current month, and month and date labels built without `toISOString()`; verify unit tests for `2026-13` and `abc` being invalid, December→January and January→December, a fake clock at 23:30 local time on 31 October still giving `2026-10-31` in a time zone ahead of UTC, and the label "October 2026"
- [x] 3.2 Add `src/features/expenses/api.ts` with types from `schema.d.ts`, query keys under `householdKey(id)` (design §5), `useExpenseCategoriesQuery`, `useExpensesInfiniteQuery(month, categoryId)`, and `useExpenseSummaryQuery(month)`; verify MSW tests that the list query sends `month`, `category_id`, and `cursor`, and that switching households removes the previous household's expense queries
- [x] 3.3 Add `src/features/expenses/mutations.ts` for creating, updating, and deleting expenses and creating and updating categories, with the invalidation in design §5 (`category_archived` also reloads categories); verify tests that a create invalidates the list and the summary, and that a category rename updates the categories query without a refetch

## 4. Expenses page

- [x] 4.1 Build `ExpensesView` with the month bar (label, previous/next, `?month=` in the URL, invalid month falls back to the current month) and register it from `routes/expenses.tsx` in place of `ComingSoon`; verify tests for every scenario of "The Expenses page shows one month at a time", with a fixed clock
- [x] 4.2 Add the expense list (newest first, date, category name including archived, `<Money>`, note), "Load more", and the empty-month state with an add action; verify tests for the scenarios of "Expenses are listed newest first"
- [x] 4.3 Add the month summary (total and per-category totals from `/expense-summary`, names from the categories query); verify tests for the "Month totals" scenario and that the page does no arithmetic on amounts (the shown totals are exactly the summary values the handler returns)
- [x] 4.4 Add the category filter (native `<select>`: "All categories", active categories, archived ones marked "(archived)"; `?category=` in the URL, kept when the month changes, cleared on a household switch); verify tests for the filter scenarios, "Filter by an archived category", and "Switch household on the Expenses page"

## 5. Expense form

- [x] 5.1 Build `ExpenseForm` in a `Sheet` for adding: `MoneyInput` in the household currency, native date input defaulting to today with `max` today, category `<select>` of active categories, optional note, and the zod rules (amount > 0, date not in the future, category required, note ≤ 500 after trimming); verify tests for "Add an expense" (body has `"amount": "45000"` and the household currency), "Zero amount", "Date in the future", and "No category"
- [x] 5.2 After a successful save, navigate to the month of the expense's date and close the sheet; map 422 field errors onto the fields (keeping the entered values) and `category_archived` onto the category field; verify tests for "Add an expense for another month", "Totals after adding an expense", and "Category archived meanwhile"
- [x] 5.3 Reuse the form for editing an existing expense (prefilled; an archived current category stays selected and is listed); verify tests for "Change the amount" and "Edit an expense in an archived category"
- [x] 5.4 Add delete with `ConfirmButton`, and handle `expense_not_found` on update or delete with "This expense no longer exists" and a reload; verify tests for "Delete an expense", "Cancel deleting", and "Expense deleted in another session"

## 6. Categories page

- [x] 6.1 Add `CategoriesView` and `routes/expense-categories.tsx`, registered as `expenses/categories` with the title "Expense categories" and linked as "Manage categories" from the Expenses page; verify tests for "Open the categories page", the document title "Expense categories · Lumior", and the "Expenses" sidebar link staying active
- [x] 6.2 Add creating and renaming categories (name 1–50 after trimming, `category_name_taken` on the name field); verify tests for "Add a category", "Name already used", "Blank name", and "Rename a category" (an expense in that category shows the new name)
- [x] 6.3 Add archiving and restoring; verify tests for "Archive a category", "Restore a category", and "Choose a category for a new expense" (an archived category is not offered in the add form)
- [x] 6.4 Add a test for "First expense in a new household": create a household through the onboarding form, open the expense form, and see the nine default categories; verify it passes against the fake backend
- [x] 6.5 Update README.md "Layout" with `features/expenses` and its query keys; verify the listed folders and files exist

## 7. Integration check

- [x] 7.1 Run `npm run lint`, `format:check`, `typecheck`, `test`, and `build`, and walk through the app in the dev server with `VITE_API_MOCKING=true`: create a household in IDR, add expenses in two months, filter by category, edit and delete one, add, rename, and archive a category, check the totals after each step, and switch households; verify every command passes and every step behaves as the specs describe

## Workflow follow-up

- Copy `contracts/expenses.md` and the updated `contracts/openapi.json` to `lumior-be/contracts/` and start the backend `expenses` change from them, including the migration that sets `IDR` on existing households and seeds their default categories.
- When the backend publishes the contract, regenerate types from it, run the same walkthrough against a real `lumior-be`, and delete the draft paths.
- Archive the change after review.

# Proposal

## Why

Recording what a household spends is the core of Lumior's budgeting, and the Expenses area is still a "coming soon" placeholder. Households and sign-in are now in place, so expenses can be stored per household. Budgets (a later change) will compare spending per category against a limit, so the expense categories introduced here must already be shared, household-level data.

The backend (`lumior-be`) has no expense endpoints yet, and a household has no currency. As in `auth-and-households`, this change also proposes the HTTP contract the frontend needs, in `contracts/expenses.md`. The frontend is built and tested against that contract with the fake backend, and the backend implements the same contract.

## What Changes

- Replace the Expenses placeholder with a monthly view: pick a month, see the month's total and the total per category, and see that month's expenses newest first, optionally filtered by one category.
- Let any member of the active household add, edit, and delete an expense with an amount, a date, a category, and an optional note.
- Add expense categories per household. A new household starts with a default set of categories. Any member can add a category, rename it, and archive or restore it. Archived categories keep their past expenses but cannot be chosen for new ones.
- Give every household one currency, chosen when the household is created (default IDR) and shown in the household settings. All of a household's expenses use it, so totals are always in one currency.
- Propose the expense, category, and household-currency endpoints to the backend in `contracts/expenses.md`, add them to the draft `contracts/openapi.json`, and extend the fake backend so tests and mock mode work without `lumior-be`.

Out of scope: budgets and spending limits, who paid for an expense, store or merchant names, receipts and attachments, recurring expenses, splitting an expense across categories, searching notes, exporting, changing a household's currency after it is created, deleting categories, and dashboard widgets.

## Capabilities

### New Capabilities

- `expenses`: Recording, editing, and deleting a household's expenses, and reviewing them per month with totals per category and a category filter.
- `expense-categories`: The household's list of expense categories: the default set, adding, renaming, archiving, and restoring categories, and which categories can be chosen for an expense.

### Modified Capabilities

- `households`: Creating a household also sets its currency (default IDR), and the household settings page shows that currency.

## Impact

- **Code**: New `src/features/expenses` (expense list, monthly summary, expense form, categories page) and a new route `/expenses/categories`. `src/routes/expenses.tsx` renders the feature instead of the placeholder. `src/features/households` gains a currency field when creating a household and shows the currency in the settings. `tests/msw/fake-backend.ts` gains household currencies, categories, and expenses.
- **API contract**: Proposes `currency` on `Household` and on `POST /api/v1/households`, and new endpoints under `/api/v1/households/{household_id}/expense-categories` and `/api/v1/households/{household_id}/expenses` (see design.md and `contracts/expenses.md`). `lumior-be` needs a matching `expenses` change, including a migration that gives existing households the currency IDR and the default categories. Until then, `src/lib/api/schema.d.ts` is generated from `contracts/openapi.json`.
- **Dependencies**: None new. The forms use the existing zod, `MoneyInput`, and shadcn/ui components.
- **Later changes**: `budgets` reads the categories from this change. `shopping-lists` ("complete trip") can create an expense through the same endpoint.

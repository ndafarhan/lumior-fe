# Spec Delta

## Purpose

Defines how members of a household record what the household spends in the Lumior web app, and how they review that spending month by month, in total and per category.

## ADDED Requirements

### Requirement: The Expenses page shows one month at a time
The Expenses page at `/expenses` SHALL show the expenses of the active household for one calendar month, chosen by the expense date. The month SHALL be part of the URL as `?month=YYYY-MM` and SHALL default to the current month in the user's time zone. The page SHALL offer controls to go to the previous and the next month.

#### Scenario: Open the page without a month
- **WHEN** a user opens `/expenses` on 15 October 2026
- **THEN** the page shows "October 2026" and the expenses dated in October 2026

#### Scenario: Go to the previous month
- **WHEN** the user on October 2026 chooses the previous month
- **THEN** the URL becomes `/expenses?month=2026-09` and the page shows the expenses dated in September 2026

#### Scenario: Invalid month in the URL
- **WHEN** the user opens `/expenses?month=2026-13`
- **THEN** the page shows the current month

### Requirement: Expenses are listed newest first
The page SHALL list the month's expenses ordered by date, newest first, and by when they were recorded for the same date, latest first. Each entry SHALL show the date, the category name, the amount in the household's currency, and the note when there is one. When the month has more expenses than one page holds, the page SHALL offer to load more.

#### Scenario: Expenses in a month
- **WHEN** October 2026 has an expense of IDR 50,000.00 for "Groceries" on 3 October and one of IDR 20,000.00 for "Transport" on 12 October
- **THEN** the "Transport" expense of 12 October is listed before the "Groceries" expense of 3 October

#### Scenario: More expenses than one page
- **WHEN** the month has more expenses than the first page returned
- **THEN** a "Load more" button is shown, and choosing it adds the next expenses below the ones already shown

#### Scenario: Month without expenses
- **WHEN** the shown month has no expenses
- **THEN** the page says there are no expenses for that month and offers to add one

### Requirement: The month's totals are shown
The page SHALL show the total of all expenses in the shown month and the total for each category that has expenses in that month, as calculated by the backend, in the household's currency. Totals SHALL update after an expense is added, changed, or deleted, without reloading the page.

#### Scenario: Month totals
- **WHEN** October 2026 has expenses of IDR 50,000.00 and IDR 25,000.00 for "Groceries" and IDR 20,000.00 for "Transport"
- **THEN** the page shows a total of IDR 95,000.00, "Groceries" IDR 75,000.00, and "Transport" IDR 20,000.00

#### Scenario: Totals after adding an expense
- **WHEN** the user adds an expense of IDR 5,000.00 for "Transport" in the shown month
- **THEN** the month total and the "Transport" total each increase by IDR 5,000.00

### Requirement: Expenses can be filtered by category
The page SHALL let the user show only the expenses of one category. The chosen category SHALL be part of the URL as `?category=<id>` and SHALL stay selected when the user changes the month. The month total SHALL stay the total of all categories.

#### Scenario: Filter by a category
- **WHEN** the user chooses the category "Groceries" in the filter
- **THEN** only "Groceries" expenses are listed, and the URL contains `category=` with that category's id

#### Scenario: Clear the filter
- **WHEN** the user chooses "All categories"
- **THEN** expenses of every category are listed and the `category` parameter is removed from the URL

### Requirement: Members add expenses
Any member of the active household SHALL be able to add an expense with an amount, a date, a category, and an optional note. The amount SHALL be in the household's currency. The date SHALL default to today. After saving, the page SHALL show the month of the new expense.

#### Scenario: Add an expense
- **WHEN** the user enters `45,000`, today's date, the category "Groceries", and the note "Weekly market" and saves
- **THEN** the expense is created with the amount `"45000"` in the household's currency and appears in the list

#### Scenario: Add an expense for another month
- **WHEN** the user on October 2026 adds an expense dated 28 September 2026
- **THEN** the page shows September 2026 with the new expense in the list

### Requirement: Expense fields are checked before sending
The expense form SHALL require an amount greater than zero that the money input accepts for the household's currency, a date that is not later than today, and a category. The note SHALL be at most 500 characters after trimming. When a value does not meet these rules, the form SHALL show the problem next to the field and SHALL NOT send a request.

#### Scenario: Zero amount
- **WHEN** the user enters `0` as the amount and saves
- **THEN** the amount field shows that the amount must be greater than zero and no request is sent

#### Scenario: Date in the future
- **WHEN** the user picks tomorrow's date and saves
- **THEN** the date field shows that the date cannot be in the future and no request is sent

#### Scenario: No category
- **WHEN** the user saves without choosing a category
- **THEN** the category field shows that a category is required and no request is sent

### Requirement: Backend validation errors appear on the expense form
When the backend rejects an expense with HTTP 422, the form SHALL show each field error next to the field it names, and SHALL show any error that names no form field above the form. The values the user entered SHALL be kept.

#### Scenario: Category archived meanwhile
- **WHEN** saving returns HTTP 422 with code `category_archived` for field `category_id`
- **THEN** the category field shows that the category is archived and the list of categories is reloaded

### Requirement: Members edit expenses
Any member of the active household SHALL be able to change the amount, date, category, and note of any of the household's expenses, with the same field rules as adding one. An expense whose category is archived SHALL keep that category selected unless the user picks another one.

#### Scenario: Change the amount
- **WHEN** the user opens the "Groceries" expense of IDR 45,000.00, changes the amount to `47,500`, and saves
- **THEN** the list shows IDR 47,500.00 for that expense and the totals are updated

#### Scenario: Edit an expense in an archived category
- **WHEN** the user opens an expense whose category "Laundry" is archived
- **THEN** "Laundry" is shown as the selected category and the expense can be saved without changing it

### Requirement: Members delete expenses
Any member of the active household SHALL be able to delete any of the household's expenses after confirming. A deleted expense SHALL disappear from the list and from the totals.

#### Scenario: Delete an expense
- **WHEN** the user chooses "Delete" on an expense and confirms
- **THEN** the expense is no longer listed and the month total decreases by its amount

#### Scenario: Cancel deleting
- **WHEN** the user chooses "Delete" on an expense and then cancels
- **THEN** no request is sent and the expense is still listed

### Requirement: An expense removed by someone else is handled
When editing or deleting an expense fails with HTTP 404 and code `expense_not_found`, the page SHALL tell the user that the expense no longer exists and reload the month.

#### Scenario: Expense deleted in another session
- **WHEN** the user saves changes to an expense that another member has already deleted
- **THEN** the page shows "This expense no longer exists" and the reloaded list no longer contains it

### Requirement: Expenses belong to the active household
The Expenses page SHALL only show expenses, totals, and categories of the active household. Switching households SHALL show the new household's expenses for the same month and SHALL clear the category filter.

#### Scenario: Switch household on the Expenses page
- **WHEN** the user on `/expenses?month=2026-10&category=<id>` switches to another household
- **THEN** the page shows the other household's expenses for October 2026 with no category filter, and none of the previous household's expenses are shown

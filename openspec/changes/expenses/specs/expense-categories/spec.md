# Spec Delta

## Purpose

Defines the expense categories of a household in the Lumior web app: the default set every household starts with, how members manage them, and which ones can be chosen for an expense, so spending can be grouped and later budgeted per category.

## ADDED Requirements

### Requirement: Households start with default categories
Every household SHALL have the categories Groceries, Dining out, Transport, Utilities, Housing, Health, Education, Entertainment, and Other from the moment it exists, so its members can record an expense without setting up categories first.

#### Scenario: First expense in a new household
- **WHEN** a user creates the household "Kos Jakarta" and opens the expense form
- **THEN** the category field offers the nine default categories

### Requirement: Categories are managed on their own page
The page `/expenses/categories`, reachable from the Expenses page, SHALL list the active household's categories in alphabetical order, with archived categories in a separate section. Any member of the household SHALL be able to use it.

#### Scenario: Open the categories page
- **WHEN** a member chooses "Manage categories" on the Expenses page
- **THEN** `/expenses/categories` lists the active categories alphabetically and the archived ones under "Archived"

### Requirement: Members add categories
A member SHALL be able to add a category with a name of 1 to 50 characters after trimming. Category names SHALL be unique within a household, ignoring letter case, including archived categories.

#### Scenario: Add a category
- **WHEN** the user adds the category "Pets"
- **THEN** "Pets" appears among the active categories and can be chosen for an expense

#### Scenario: Name already used
- **WHEN** the user adds "groceries" while "Groceries" exists, and the backend returns HTTP 409 with code `category_name_taken`
- **THEN** the name field shows "A category with this name already exists"

#### Scenario: Blank name
- **WHEN** the user submits a category name containing only spaces
- **THEN** the name field shows that a name is required and no request is sent

### Requirement: Members rename categories
A member SHALL be able to rename a category, active or archived, under the same name rules as adding one. Expenses in that category SHALL show the new name.

#### Scenario: Rename a category
- **WHEN** the user renames "Dining out" to "Restaurants"
- **THEN** the categories page lists "Restaurants", and expenses that were in "Dining out" show "Restaurants"

### Requirement: Members archive and restore categories
A member SHALL be able to archive an active category and restore an archived one. Archiving SHALL NOT change existing expenses: they keep the category and still count in its totals.

#### Scenario: Archive a category
- **WHEN** the user archives "Education"
- **THEN** "Education" moves to the archived section, and expenses already in "Education" still show it

#### Scenario: Restore a category
- **WHEN** the user restores the archived category "Education"
- **THEN** "Education" is listed among the active categories again and can be chosen for new expenses

### Requirement: Only active categories can be chosen for new expenses
The category field of the expense form and the category filter SHALL offer the active categories in alphabetical order. The filter SHALL also offer archived categories, marked as archived, so their past expenses can still be found. The backend SHALL reject an expense that uses an archived category, except when the expense already had it.

#### Scenario: Choose a category for a new expense
- **WHEN** the user opens the form to add an expense while "Education" is archived
- **THEN** "Education" is not offered as a category

#### Scenario: Filter by an archived category
- **WHEN** the user opens the category filter while "Education" is archived
- **THEN** "Education (archived)" is offered and choosing it lists its expenses

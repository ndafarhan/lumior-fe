# Spec Delta

## ADDED Requirements

### Requirement: The shell shows the active household and the account menu
For a signed-in user, the shell SHALL show the active household's name with a control to switch households, create a household, or open household settings, and an account menu showing the user's display name with links to account settings and a "Sign out" action. Both SHALL be reachable at every viewport width.

#### Scenario: Open the account menu
- **WHEN** the signed-in user "Rina" opens the account menu
- **THEN** it shows "Rina", an "Account settings" link to `/account`, and "Sign out"

#### Scenario: Household control on a narrow window
- **WHEN** the app is shown in a window 800 pixels wide and the user opens the menu
- **THEN** the active household's name and the household switcher are available in the menu

## MODIFIED Requirements

### Requirement: Desktop layout with sidebar navigation
The app SHALL render a layout with a persistent sidebar and a main content area at viewport widths of 1024 pixels and above for a signed-in user who has an active household. The sidebar SHALL link to the MVP areas Dashboard, Budgets, Expenses, Catalog, Shopping Lists, and Optimize, and SHALL mark the link of the current area as active. Sign-in, registration, onboarding, and invitation pages SHALL render without the sidebar.

#### Scenario: Navigate between areas
- **WHEN** the user clicks "Budgets" in the sidebar
- **THEN** the URL changes to `/budgets`, the Budgets page renders in the main content area without a full page reload, and the "Budgets" link is marked active

#### Scenario: Direct link to an area
- **WHEN** a signed-in user with an active household opens `/shopping-lists` directly in the browser
- **THEN** the Shopping Lists page renders inside the layout with "Shopping Lists" marked active

#### Scenario: Sign-in page has no sidebar
- **WHEN** a signed-out visitor is shown the sign-in page
- **THEN** no sidebar or navigation links to app areas are shown

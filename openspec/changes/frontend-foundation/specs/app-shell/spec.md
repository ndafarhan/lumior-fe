# Spec Delta

## Purpose

Defines the application frame of the Lumior web app (layout, navigation, routing, error and not-found handling, and backend availability) that every feature area plugs into.

## ADDED Requirements

### Requirement: Desktop layout with sidebar navigation
The app SHALL render a layout with a persistent sidebar and a main content area at viewport widths of 1024 pixels and above. The sidebar SHALL link to the MVP areas Dashboard, Budgets, Expenses, Catalog, Shopping Lists, and Optimize, and SHALL mark the link of the current area as active.

#### Scenario: Navigate between areas
- **WHEN** the user clicks "Budgets" in the sidebar
- **THEN** the URL changes to `/budgets`, the Budgets page renders in the main content area without a full page reload, and the "Budgets" link is marked active

#### Scenario: Direct link to an area
- **WHEN** the user opens `/shopping-lists` directly in the browser
- **THEN** the Shopping Lists page renders inside the layout with "Shopping Lists" marked active

### Requirement: Narrow viewports remain usable
At viewport widths below 1024 pixels, the app SHALL collapse the sidebar into a menu toggle so that all areas stay reachable without horizontal scrolling.

#### Scenario: Narrow window
- **WHEN** the app is shown in a window 800 pixels wide
- **THEN** the sidebar is hidden behind a menu button, and opening the menu shows all navigation links

### Requirement: Areas not yet built show a placeholder
Each MVP area whose feature has not been delivered SHALL render a placeholder page naming the area and stating that it is not available yet, instead of an error or a blank page.

#### Scenario: Visit an unbuilt area
- **WHEN** the user opens `/optimize` before the optimization feature exists
- **THEN** the page shows the title "Optimize" and a "coming soon" message

### Requirement: Unknown routes show a not-found page
The app SHALL render a not-found page with a link back to the dashboard for any URL that matches no route.

#### Scenario: Mistyped URL
- **WHEN** the user opens `/does-not-exist`
- **THEN** the app shows a "Page not found" page inside the layout with a link to `/`

### Requirement: Unexpected errors are contained by an error boundary
When rendering a page throws an unexpected error, the app SHALL replace only the main content area with an error page offering a retry action, keep the sidebar usable, and show the request ID when the error came from an API call.

#### Scenario: Page fails while rendering
- **WHEN** a page component throws during rendering
- **THEN** the main content area shows "Something went wrong" with a "Try again" button, and the sidebar links still work

#### Scenario: Page fails because of an API error
- **WHEN** a page fails because an API call returned an error with request ID `r-42`
- **THEN** the error page shows the reference `r-42` so the user can report it

### Requirement: Backend availability is visible
The app SHALL check the backend readiness endpoint when it starts and every 60 seconds while the window is visible, and SHALL show a persistent banner while the backend is unreachable or not ready, removing it once a check succeeds.

#### Scenario: Backend down
- **WHEN** the readiness check fails with a network error or a non-200 response
- **THEN** the app shows a banner stating that the server is unavailable

#### Scenario: Backend recovers
- **WHEN** a later readiness check returns HTTP 200 with status `ok`
- **THEN** the banner is removed without a page reload

### Requirement: Page titles reflect the current area
The app SHALL set the browser document title to the current area name followed by "Lumior".

#### Scenario: Title on the Catalog page
- **WHEN** the user navigates to `/catalog`
- **THEN** the document title is "Catalog · Lumior"

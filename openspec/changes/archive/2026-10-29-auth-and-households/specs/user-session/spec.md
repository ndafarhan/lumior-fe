# Spec Delta

## Purpose

Defines how a person signs in to and out of the Lumior web app, how the session is kept and restored without storing credentials in browser storage, and how app areas are restricted to signed-in users.

## ADDED Requirements

### Requirement: Users sign in with email and password
The app SHALL provide a sign-in page at `/login` with email and password fields. On success the user is signed in and taken to the page they originally requested, or to the dashboard when there is none. On failure the page SHALL show an error and keep the entered email.

#### Scenario: Successful sign-in
- **WHEN** a signed-out user enters a registered email and the correct password on `/login`
- **THEN** the user is signed in and sees the dashboard

#### Scenario: Wrong credentials
- **WHEN** the backend rejects the sign-in with HTTP 401 and code `invalid_credentials`
- **THEN** the page shows "Incorrect email or password", keeps the email, and clears the password field

#### Scenario: Missing fields
- **WHEN** the user submits the sign-in form with an empty email or password
- **THEN** the form shows which field is required and sends no request

### Requirement: App areas require sign-in
Every page except sign-in and registration, including the not-found page, SHALL be available only to a signed-in user. A signed-out visitor who opens any other URL SHALL be sent to `/login`, and after signing in SHALL be returned to that URL, including its query string.

#### Scenario: Signed-out visitor opens an area
- **WHEN** a signed-out visitor opens `/budgets?month=2026-10`
- **THEN** the app shows the sign-in page, and after a successful sign-in the user is at `/budgets?month=2026-10`

#### Scenario: Return target outside the app
- **WHEN** the sign-in page is opened with a return target that is an absolute URL to another origin
- **THEN** after signing in the user is taken to the dashboard instead

#### Scenario: Signed-in user opens the sign-in page
- **WHEN** a signed-in user opens `/login` or `/register`
- **THEN** the app takes them to the dashboard

### Requirement: Credentials are never stored in browser storage
The app SHALL keep the access token only in memory and SHALL NOT write the access token, the refresh token, or the password to localStorage, sessionStorage, IndexedDB, or a cookie readable by scripts. The refresh token SHALL exist only as an httpOnly cookie set by the backend.

#### Scenario: After signing in
- **WHEN** the user has signed in
- **THEN** no access token, refresh token, or password is present in localStorage, sessionStorage, IndexedDB, or `document.cookie`

### Requirement: The session is restored on page load
When the app loads, it SHALL try to restore the session from the refresh cookie before showing any app area, and SHALL show a loading state until it knows whether the user is signed in.

#### Scenario: Reload while signed in
- **WHEN** a signed-in user reloads `/expenses` and the backend accepts the refresh cookie
- **THEN** the Expenses page renders without showing the sign-in page

#### Scenario: Reload without a valid session
- **WHEN** the app loads and the backend rejects the refresh with HTTP 401
- **THEN** the app treats the visitor as signed out

#### Scenario: Backend unreachable on load
- **WHEN** the app loads and the refresh request fails with a network error or timeout
- **THEN** the app shows a message that the server cannot be reached with a "Try again" action, and does not show the sign-in page

### Requirement: An expired session ends with a clear message
When the session can no longer be refreshed, the app SHALL sign the user out locally, discard cached user and household data, and show the sign-in page with the message "Your session has expired. Please sign in again.", returning the user to the page they were on after they sign in.

#### Scenario: Refresh rejected during use
- **WHEN** an API call returns HTTP 401 and the following refresh also returns HTTP 401
- **THEN** the sign-in page shows the session-expired message, and signing in returns the user to the page they were on

### Requirement: Users sign out
The app SHALL offer a "Sign out" action that asks the backend to end the session, discards the in-memory token and cached user and household data, and shows the sign-in page. Signing out SHALL complete locally even if the backend request fails.

#### Scenario: Sign out
- **WHEN** the signed-in user chooses "Sign out"
- **THEN** the backend sign-out request is sent and the sign-in page is shown

#### Scenario: Sign out while the backend is down
- **WHEN** the user chooses "Sign out" and the sign-out request fails with a network error
- **THEN** the user is still signed out in the app and sees the sign-in page

### Requirement: Signing out applies to every open tab
When the user signs out in one browser tab, other open tabs of the app SHALL also sign out and show the sign-in page.

#### Scenario: Two tabs open
- **WHEN** the user signs out in one tab while a second tab shows the dashboard
- **THEN** the second tab shows the sign-in page without the user reloading it

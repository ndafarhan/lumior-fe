# Spec Delta

## Purpose

Defines how a person creates a Lumior account in the web app and manages it afterwards, covering the display name and the password.

## ADDED Requirements

### Requirement: Visitors register an account
The app SHALL provide a registration page at `/register` with display name, email, and password fields. A successful registration SHALL sign the user in immediately.

#### Scenario: Successful registration
- **WHEN** a visitor enters the name "Rina", a new email, and a valid password on `/register`
- **THEN** the account is created, the user is signed in, and the household onboarding page is shown

#### Scenario: Email already registered
- **WHEN** the backend rejects the registration with HTTP 409 and code `email_taken`
- **THEN** the email field shows "An account with this email already exists" with a link to sign in

### Requirement: Account fields are checked before sending
The registration and account forms SHALL require a display name of 1 to 100 characters after trimming, an email address containing `@`, and a password of 8 to 128 characters, and SHALL show the problem next to the field without sending a request when a value does not meet these rules.

#### Scenario: Short password
- **WHEN** the visitor enters a 6-character password on the registration form
- **THEN** the password field shows that at least 8 characters are required and no request is sent

#### Scenario: Blank name
- **WHEN** the display name contains only spaces
- **THEN** the name field shows that a name is required and no request is sent

### Requirement: Backend validation errors appear on their fields
When the backend rejects a registration or account update with HTTP 422, the form SHALL show each field error next to the field it names, and SHALL show any error that names no form field above the form.

#### Scenario: Backend rejects the email
- **WHEN** registration returns HTTP 422 with a detail for field `email`
- **THEN** that reason is shown next to the email field

### Requirement: Users change their display name
The account settings page at `/account` SHALL show the user's email and display name and SHALL let the user change the display name. The new name SHALL appear in the shell without a page reload.

#### Scenario: Rename
- **WHEN** the user changes the display name to "Rina S." and saves
- **THEN** the page confirms the change and the account menu shows "Rina S."

### Requirement: Users change their password
The account settings page SHALL let the user change the password by entering the current password and a new password. The user SHALL stay signed in on the current tab after the change.

#### Scenario: Successful change
- **WHEN** the user enters the correct current password and a valid new password
- **THEN** the page confirms the password was changed, clears both fields, and the user stays signed in

#### Scenario: Wrong current password
- **WHEN** the backend rejects the change with HTTP 400 and code `invalid_current_password`
- **THEN** the current-password field shows "Current password is incorrect" and the new password is not cleared

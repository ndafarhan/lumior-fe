# Spec Delta

## Purpose

Defines how users of the Lumior web app create and belong to households, choose which household they are working in, manage membership, and invite others to join, since all budgeting and shopping data belongs to a household.

## ADDED Requirements

### Requirement: Users without a household are onboarded
A signed-in user who belongs to no household SHALL be shown an onboarding page instead of the app areas. The page SHALL let the user create a household and SHALL explain that joining an existing household requires an invite link from its owner.

#### Scenario: First sign-in after registration
- **WHEN** a user with no households opens `/budgets`
- **THEN** the onboarding page is shown with a "Create household" form

#### Scenario: Household created during onboarding
- **WHEN** the user creates the household "Rumah Bandung" on the onboarding page
- **THEN** it becomes the active household and the page the user originally requested is shown

### Requirement: Users create households
A signed-in user SHALL be able to create a household with a name of 1 to 100 characters after trimming, and SHALL become its owner. A newly created household SHALL become the active household.

#### Scenario: Create a second household
- **WHEN** a user who already belongs to "Rumah Bandung" creates "Kos Jakarta"
- **THEN** "Kos Jakarta" is the active household and both appear in the household switcher

#### Scenario: Blank name
- **WHEN** the user submits a household name containing only spaces
- **THEN** the name field shows that a name is required and no request is sent

### Requirement: One household is active at a time
The app SHALL keep exactly one active household for a signed-in user who belongs to at least one household. The shell SHALL show the active household's name and let the user switch to any other household they belong to. Switching SHALL keep the current page and SHALL discard household data cached for the previous household.

#### Scenario: Switch household
- **WHEN** the user on `/expenses` switches from "Rumah Bandung" to "Kos Jakarta"
- **THEN** the user stays on `/expenses`, the shell shows "Kos Jakarta", and no data from "Rumah Bandung" is shown

### Requirement: The active household is remembered per user
The app SHALL remember each user's last active household on the device and select it after the next sign-in or page load. When the remembered household is no longer one the user belongs to, the app SHALL select the first household in the list.

#### Scenario: Reload keeps the household
- **WHEN** the user with "Kos Jakarta" active reloads the page
- **THEN** "Kos Jakarta" is still the active household

#### Scenario: Removed from the remembered household
- **WHEN** the user's remembered household is no longer in the user's household list
- **THEN** the first household in the list becomes active

#### Scenario: Different user on the same device
- **WHEN** another user signs in on the same browser
- **THEN** that user's own remembered household is used, not the previous user's

### Requirement: Household settings show members and roles
The household settings page at `/household` SHALL show the active household's name and its members, each with display name, email, and role (`owner` or `member`), and SHALL mark the current user.

#### Scenario: View members
- **WHEN** a member of "Rumah Bandung" opens `/household`
- **THEN** the page lists every member with their name, email, and role, and marks the user as "You"

### Requirement: Only owners rename households and manage members
The household settings page SHALL let an owner rename the household and remove members other than themselves, and SHALL NOT show these actions to members. Removing a member SHALL ask for confirmation first.

#### Scenario: Owner removes a member
- **WHEN** the owner chooses "Remove" for member "Budi" and confirms
- **THEN** "Budi" is no longer listed among the members

#### Scenario: Member views settings
- **WHEN** a user with role `member` opens `/household`
- **THEN** the rename field, the remove actions, and the invite action are not shown

#### Scenario: Backend refuses an owner action
- **WHEN** an owner action fails with HTTP 403
- **THEN** the page shows "You don't have permission to do this" and refreshes the member list

### Requirement: Members leave households
A user with role `member` SHALL be able to leave the active household after confirming. The owner SHALL NOT be offered a leave action. After leaving, the app SHALL make another of the user's households active, or show the onboarding page when none is left.

#### Scenario: Leave one of two households
- **WHEN** a member of "Kos Jakarta" and "Rumah Bandung" leaves "Kos Jakarta"
- **THEN** "Rumah Bandung" becomes the active household and "Kos Jakarta" is no longer in the switcher

#### Scenario: Leave the only household
- **WHEN** a user leaves their only household
- **THEN** the onboarding page is shown

### Requirement: Losing access to the active household is handled
When a request for the active household fails with HTTP 403 or 404 because the user is no longer a member or the household no longer exists, the app SHALL reload the user's household list, choose an active household again, and tell the user they no longer have access to the previous one.

#### Scenario: Removed by the owner while using the app
- **WHEN** the user's next request for "Kos Jakarta" returns HTTP 403
- **THEN** the app shows "You no longer have access to Kos Jakarta" and switches to another household or to onboarding

### Requirement: Owners invite people with a link
The owner SHALL be able to create an invite link for the active household from the household settings page, see when it expires, and copy it to the clipboard.

#### Scenario: Create an invite
- **WHEN** the owner chooses "Invite member"
- **THEN** the page shows a link of the form `<app origin>/invite/<code>`, its expiry time, and a "Copy link" button

### Requirement: Users join a household through an invite link
Opening `/invite/<code>` SHALL require sign-in, then SHALL show the household name and who sent the invite, with "Join" and "Cancel" actions. Joining SHALL make that household active. Invalid, expired, and already-used invites SHALL show an explanation instead of the actions.

#### Scenario: Signed-out user opens an invite
- **WHEN** a signed-out visitor opens `/invite/abc123`
- **THEN** the sign-in page is shown with a link to register, and after signing in or registering the user sees the invite for `abc123`

#### Scenario: Accept an invite
- **WHEN** the user chooses "Join" on the invite for "Kos Jakarta"
- **THEN** the user becomes a member, "Kos Jakarta" is the active household, and the dashboard is shown

#### Scenario: Already a member
- **WHEN** the user opens an invite for a household they already belong to
- **THEN** the page says they are already a member and offers to switch to that household

#### Scenario: Expired invite
- **WHEN** the invite lookup returns HTTP 410 with code `invite_expired`
- **THEN** the page says the invite has expired and asks the user to request a new link

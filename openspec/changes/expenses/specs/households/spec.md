# Spec Delta

## MODIFIED Requirements

### Requirement: Users create households
A signed-in user SHALL be able to create a household with a name of 1 to 100 characters after trimming and a currency chosen from the currencies the app supports, defaulting to IDR, and SHALL become its owner. A newly created household SHALL become the active household. A household's currency SHALL NOT change after it is created.

#### Scenario: Create a second household
- **WHEN** a user who already belongs to "Rumah Bandung" creates "Kos Jakarta"
- **THEN** "Kos Jakarta" is the active household and both appear in the household switcher

#### Scenario: Blank name
- **WHEN** the user submits a household name containing only spaces
- **THEN** the name field shows that a name is required and no request is sent

#### Scenario: Default currency
- **WHEN** the user creates a household without changing the currency field
- **THEN** the household is created with the currency IDR

#### Scenario: Choose another currency
- **WHEN** the user creates the household "Flat Singapore" with the currency SGD
- **THEN** the household's expenses are entered and shown in SGD

### Requirement: Household settings show members and roles
The household settings page at `/household` SHALL show the active household's name, its currency, and its members, each with display name, email, and role (`owner` or `member`), and SHALL mark the current user.

#### Scenario: View members
- **WHEN** a member of "Rumah Bandung" opens `/household`
- **THEN** the page lists every member with their name, email, and role, and marks the user as "You"

#### Scenario: View the currency
- **WHEN** a member of a household with the currency IDR opens `/household`
- **THEN** the page shows the currency IDR and offers no way to change it

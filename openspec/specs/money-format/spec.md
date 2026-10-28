# money-format Specification

## Purpose

Defines how the Lumior frontend displays monetary amounts received from the backend and turns user-entered amounts into values the backend accepts, without loss of precision from floating-point conversion.

## Requirements

### Requirement: Amounts are displayed with their currency
The frontend SHALL display a monetary value received as `{"amount": "<decimal string>", "currency": "<ISO 4217 code>"}` in English number formatting with thousands separators, the currency symbol or code, and the currency's standard number of decimal places.

#### Scenario: Rupiah amount
- **WHEN** the frontend displays `{"amount": "12500.00", "currency": "IDR"}`
- **THEN** the text shows the amount as twelve thousand five hundred with a thousands separator and the IDR currency marker, for example `IDR 12,500.00`

#### Scenario: Zero-decimal currency
- **WHEN** the frontend displays `{"amount": "1500", "currency": "JPY"}`
- **THEN** the text shows `¥1,500` with no decimal places

#### Scenario: Negative amount
- **WHEN** the frontend displays `{"amount": "-250.50", "currency": "USD"}`
- **THEN** the text shows a negative sign and `$250.50`

### Requirement: Amounts are never converted to floating-point numbers
The frontend SHALL keep monetary amounts as decimal strings from the API response through to display and back to API requests, so that every digit sent by the backend is shown exactly.

#### Scenario: Amount beyond floating-point precision
- **WHEN** the frontend displays `{"amount": "123456789012.35", "currency": "IDR"}`
- **THEN** the displayed digits are exactly `123,456,789,012.35`

### Requirement: Unsupported or malformed amounts are shown as unavailable
When an amount is not a decimal string or the currency code is not a three-letter ISO 4217 code, the frontend SHALL display a placeholder instead of a wrong number and SHALL NOT throw an error that breaks the page.

#### Scenario: Malformed amount
- **WHEN** the frontend displays `{"amount": "abc", "currency": "IDR"}`
- **THEN** the text shows `—` and the rest of the page renders normally

### Requirement: User-entered amounts are validated and normalized
The frontend SHALL accept user-entered amounts made of digits with optional thousands separators (`,`) and an optional decimal point, and SHALL convert them to a plain decimal string. It SHALL reject input with letters, more than one decimal point, or more decimal places than the currency allows, with a message describing the problem.

#### Scenario: Amount with thousands separators
- **WHEN** the user enters `12,500` for currency IDR
- **THEN** the value sent to the backend is the string `"12500"`

#### Scenario: Too many decimal places
- **WHEN** the user enters `10.555` for currency USD
- **THEN** the input is rejected with a message that at most 2 decimal places are allowed, and nothing is sent

#### Scenario: Non-numeric input
- **WHEN** the user enters `12a`
- **THEN** the input is rejected with a message that the amount must be a number

### Requirement: Negative amounts are rejected unless allowed
Amount inputs SHALL reject negative values unless the specific input explicitly allows them.

#### Scenario: Negative amount in a default input
- **WHEN** the user enters `-100` into an amount input that does not allow negatives
- **THEN** the input is rejected with a message that the amount must not be negative

### Requirement: Amounts are sent to the backend as strings
The frontend SHALL send monetary amounts in request bodies as `{"amount": "<decimal string>", "currency": "<code>"}`, with the amount as a JSON string and never a JSON number.

#### Scenario: Submitting an amount
- **WHEN** a form submits the amount `12500` in IDR
- **THEN** the request body contains `"amount": "12500"` as a string and `"currency": "IDR"`

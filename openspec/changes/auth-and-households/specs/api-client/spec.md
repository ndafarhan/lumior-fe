# Spec Delta

## ADDED Requirements

### Requirement: Authenticated requests carry the access token
While the user is signed in, the frontend SHALL send the current access token as `Authorization: Bearer <token>` on every request to `/api/v1`, except the sign-in, registration, refresh, and sign-out requests.

#### Scenario: Request while signed in
- **WHEN** a signed-in user's page loads its data
- **THEN** the request carries an `Authorization` header with the current access token

#### Scenario: Request while signed out
- **WHEN** no user is signed in
- **THEN** requests are sent without an `Authorization` header

### Requirement: A 401 response triggers one token refresh and one retry
When a request carrying an access token receives HTTP 401, the frontend SHALL refresh the access token once and repeat the original request once with the new token. Requests that receive 401 at the same time SHALL share a single refresh. If the refresh fails, the original request SHALL fail with its 401 API error and the session SHALL end.

#### Scenario: Access token expired
- **WHEN** a GET request returns HTTP 401 and the refresh succeeds
- **THEN** the request is repeated once with the new token and the caller receives its successful response

#### Scenario: Several requests expire together
- **WHEN** three requests return HTTP 401 at the same time
- **THEN** exactly one refresh request is sent, and all three requests are repeated with the new token

#### Scenario: Still unauthorized after refresh
- **WHEN** a request returns HTTP 401, the refresh succeeds, and the repeated request returns HTTP 401 again
- **THEN** the request fails with the 401 API error and no further refresh is attempted for it

## MODIFIED Requirements

### Requirement: Read requests are retried, write requests are not
The frontend SHALL retry a failed read (GET) request at most twice when the failure is a network error, a timeout, or an HTTP 5xx response, and SHALL NOT automatically retry write requests (POST, PUT, PATCH, DELETE) or any 4xx response. The single repeat of a request after a successful token refresh following an HTTP 401 is not counted as a retry and SHALL apply to write requests too, because the backend rejected the original request before processing it.

#### Scenario: Transient server error on a read
- **WHEN** a GET request fails with HTTP 503 and the next attempt succeeds
- **THEN** the caller receives the successful response

#### Scenario: Client error on a read
- **WHEN** a GET request fails with HTTP 404
- **THEN** the request is not retried

#### Scenario: Failure on a write
- **WHEN** a POST request fails with a network error
- **THEN** the request is not retried and the caller receives the network error

#### Scenario: Write rejected because the access token expired
- **WHEN** a POST request returns HTTP 401 and the token refresh succeeds
- **THEN** the POST request is sent once more with the new token

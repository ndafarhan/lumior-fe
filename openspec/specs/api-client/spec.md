# api-client Specification

## Purpose

Defines how the Lumior frontend communicates with the backend API, so every feature gets the same base URL handling, typed requests, error interpretation, and request tracing.

## Requirements

### Requirement: Backend base URL is configured per environment
The frontend SHALL read the backend base URL from build-time configuration and SHALL refuse to start with a clear configuration error when the value is missing or is not an absolute http(s) URL.

#### Scenario: Valid base URL
- **WHEN** the app is built with the backend base URL set to `http://localhost:8000`
- **THEN** API requests are sent to `http://localhost:8000/api/v1/...`

#### Scenario: Invalid base URL
- **WHEN** the app starts with the backend base URL set to `not-a-url`
- **THEN** the app shows a configuration error screen naming the invalid setting and sends no API requests

### Requirement: API calls are typed from the published OpenAPI document
The frontend's request and response types for backend endpoints SHALL be derived from the backend's published OpenAPI document, so a contract change that breaks the frontend is detected by the type check rather than at runtime.

#### Scenario: Backend contract changes a field
- **WHEN** the API types are regenerated from an OpenAPI document in which a field used by the frontend was removed
- **THEN** the frontend type check fails and names the code that used the field

### Requirement: Backend error envelope is mapped to a typed API error
When the backend responds with a non-2xx status and a body of the form `{"error": {"code", "message", "details", "request_id"}}`, the frontend SHALL produce an API error carrying the HTTP status, `code`, `message`, `details`, and `request_id`.

#### Scenario: Not found response
- **WHEN** an API call receives HTTP 404 with `error.code` equal to `not_found` and `error.request_id` equal to `r-1`
- **THEN** the call fails with an API error whose status is 404, code is `not_found`, and request ID is `r-1`

#### Scenario: Validation error with field details
- **WHEN** an API call receives HTTP 422 with `error.code` equal to `validation_error` and a details entry for field `name`
- **THEN** the call fails with an API error whose details expose the location `name` and its reason, so a form can show the message next to that field

#### Scenario: Error body is not the envelope
- **WHEN** an API call receives HTTP 502 with an HTML body
- **THEN** the call fails with an API error whose status is 502, code is `http_error`, and request ID is taken from the `X-Request-ID` response header if present

### Requirement: Network failures and timeouts are distinct errors
The frontend SHALL report a request that cannot reach the backend as a network error and a request that exceeds the request timeout as a timeout error, each distinguishable from API errors returned by the backend.

#### Scenario: Backend unreachable
- **WHEN** an API call is made while the backend is not running
- **THEN** the call fails with a network error, and the user sees a message that the server cannot be reached

#### Scenario: Request exceeds the timeout
- **WHEN** the backend does not respond within the request timeout of 15 seconds
- **THEN** the request is aborted and fails with a timeout error

### Requirement: Every API request carries a request ID
The frontend SHALL send an `X-Request-ID` header with every API request, using a newly generated ID of at most 128 visible ASCII characters, so a frontend error can be matched with backend logs.

#### Scenario: Request ID sent and echoed
- **WHEN** the frontend makes an API call
- **THEN** the request includes an `X-Request-ID` header, and an API error from that call reports the same request ID that the backend echoed

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

### Requirement: Credentials are included on API requests
The frontend SHALL send API requests with browser credentials included, so cookie-based sessions introduced by later authentication work operate across the frontend and backend origins.

#### Scenario: Cross-origin API request
- **WHEN** the frontend at `http://localhost:5173` calls the backend at `http://localhost:8000`
- **THEN** the request is made in credentialed mode

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

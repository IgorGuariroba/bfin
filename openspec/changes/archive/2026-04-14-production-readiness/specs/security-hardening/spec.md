## ADDED Requirements

### Requirement: Security headers via helmet
The system SHALL register `@fastify/helmet` on the Fastify instance with defaults suitable for a JSON API (Content-Security-Policy disabled, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Strict-Transport-Security` enabled).

#### Scenario: Response includes security headers
- **WHEN** a client sends any HTTP request to the API
- **THEN** the response includes `X-Content-Type-Options: nosniff` AND `X-Frame-Options: DENY` AND `Strict-Transport-Security` with a max-age of at least 15552000

### Requirement: CORS policy configurable via environment
The system SHALL register `@fastify/cors`. The allowed origin MUST be read from `CORS_ORIGIN`. If `CORS_ORIGIN` is unset in production, CORS MUST default to denying all cross-origin requests.

#### Scenario: Origin matches CORS_ORIGIN
- **WHEN** `CORS_ORIGIN=https://app.example.com` and a browser sends a cross-origin request from that origin
- **THEN** the response includes `Access-Control-Allow-Origin: https://app.example.com`

#### Scenario: Origin not in allowlist
- **WHEN** a browser sends a cross-origin request from an origin not listed in `CORS_ORIGIN`
- **THEN** the response does not include `Access-Control-Allow-Origin` and the browser blocks the request

### Requirement: Rate limiting
The system SHALL register `@fastify/rate-limit` with a global default of 100 requests per minute per IP, configurable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW`. Exceeding the limit MUST yield HTTP 429 with a `Retry-After` header.

#### Scenario: Request under limit
- **WHEN** a client sends fewer than `RATE_LIMIT_MAX` requests within the window
- **THEN** all requests succeed normally

#### Scenario: Request exceeds limit
- **WHEN** a client sends `RATE_LIMIT_MAX + 1` requests within the window
- **THEN** the extra request receives HTTP 429 and the response includes a `Retry-After` header

### Requirement: Request body size and timeout limits
The Fastify instance SHALL enforce `bodyLimit: 1_048_576` (1 MB), `connectionTimeout: 10_000` ms, and `keepAliveTimeout: 5_000` ms.

#### Scenario: Request body too large
- **WHEN** a client sends a POST request with a body larger than 1 MB
- **THEN** the response status is 413 (Payload Too Large)

#### Scenario: Idle connection beyond keep-alive timeout
- **WHEN** a connection is idle for longer than 5 seconds
- **THEN** the server closes the connection

### Requirement: Log redaction of sensitive fields
The Pino logger configured on the Fastify instance SHALL redact the paths `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`, `password`, and `token` with the redaction marker `[Redacted]`.

#### Scenario: Request with Authorization header is logged
- **WHEN** a request is received with `Authorization: Bearer abc123` and is logged
- **THEN** the log entry contains `"authorization":"[Redacted]"` and does NOT contain the string `abc123`

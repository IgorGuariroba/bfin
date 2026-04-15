## ADDED Requirements

### Requirement: Liveness endpoint
The system SHALL expose `GET /health/live` which returns HTTP 200 with body `{"status":"ok"}` whenever the process is running. This endpoint MUST NOT perform any external I/O (no database, no network) and MUST respond in under 50 ms under normal load.

#### Scenario: Process is running
- **WHEN** a client sends `GET /health/live`
- **THEN** the response status is 200 and the body is `{"status":"ok"}`

#### Scenario: Database is unreachable
- **WHEN** Postgres is down and a client sends `GET /health/live`
- **THEN** the response status is still 200 because liveness does not depend on external dependencies

### Requirement: Readiness endpoint
The system SHALL expose `GET /health/ready` which returns HTTP 200 when the service can serve traffic, including a successful `SELECT 1` against Postgres with a 2-second timeout. When any dependency check fails, the endpoint MUST return HTTP 503 with a body indicating which dependency failed.

#### Scenario: All dependencies healthy
- **WHEN** Postgres responds to `SELECT 1` within 2 seconds and a client sends `GET /health/ready`
- **THEN** the response status is 200 and the body is `{"status":"ok"}`

#### Scenario: Database unreachable
- **WHEN** Postgres is unreachable and a client sends `GET /health/ready`
- **THEN** the response status is 503 and the body identifies `database` as the failed dependency

#### Scenario: Database slow beyond timeout
- **WHEN** Postgres takes longer than 2 seconds to respond to `SELECT 1`
- **THEN** the readiness probe returns 503 and does not hang the request

### Requirement: Legacy `/health` alias
The system SHALL keep `GET /health` responding with HTTP 200 for backward compatibility during this release cycle, behaving identically to `/health/live` and including an HTTP header `Deprecation: true` and a `Link` header pointing to `/health/live`.

#### Scenario: Client hits deprecated endpoint
- **WHEN** a client sends `GET /health`
- **THEN** the response status is 200 with body `{"status":"ok"}` AND the response includes header `Deprecation: true`

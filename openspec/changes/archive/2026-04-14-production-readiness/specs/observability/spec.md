## ADDED Requirements

### Requirement: Prometheus metrics endpoint
The system SHALL expose `GET /metrics` returning Prometheus-format text metrics via `fastify-metrics`, including HTTP RED metrics (rate, errors, duration) and Node.js runtime metrics (event loop lag, heap size, GC duration).

#### Scenario: Client scrapes metrics
- **WHEN** a client sends `GET /metrics`
- **THEN** the response status is 200 AND the `Content-Type` is `text/plain; version=0.0.4; charset=utf-8` AND the body contains metric families `http_request_duration_seconds`, `nodejs_eventloop_lag_seconds`, and `process_resident_memory_bytes`

### Requirement: Request correlation via `reqId`
Every log line emitted during the lifetime of an HTTP request SHALL include a `reqId` field. The `reqId` MUST be taken from the inbound `x-request-id` header when present; otherwise it MUST be generated server-side.

#### Scenario: Inbound request carries x-request-id
- **WHEN** a client sends a request with header `x-request-id: abc-123`
- **THEN** every log line for that request contains `"reqId":"abc-123"`

#### Scenario: Inbound request without x-request-id
- **WHEN** a client sends a request without an `x-request-id` header
- **THEN** every log line for that request contains a non-empty server-generated `reqId`

### Requirement: Structured JSON logs
All logs SHALL be emitted as single-line JSON via Pino, including at minimum the fields `level`, `time`, `msg`, and (during requests) `reqId`.

#### Scenario: Log output format
- **WHEN** the server logs any message during a request
- **THEN** the log line is valid JSON AND contains the keys `level`, `time`, `msg`, and `reqId`

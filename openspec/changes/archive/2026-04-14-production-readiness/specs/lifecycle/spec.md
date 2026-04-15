## ADDED Requirements

### Requirement: Environment validation on boot
The system SHALL validate all required environment variables at process startup using a schema. If any required variable is missing or malformed, the process MUST exit with code 1 and print a human-readable error listing every offending variable.

#### Scenario: Missing required variable
- **WHEN** the process starts without `DATABASE_URL` set
- **THEN** the process exits with code 1 and stderr contains the name `DATABASE_URL` and the validation reason

#### Scenario: All variables valid
- **WHEN** the process starts with all required variables present and well-formed
- **THEN** the server binds to the configured port and begins accepting requests

### Requirement: Graceful shutdown on termination signals
The system SHALL handle `SIGTERM` and `SIGINT` by stopping new connections, draining in-flight requests, closing database connections, and exiting with code 0 within 10 seconds. If draining exceeds 10 seconds, the process MUST force-exit with code 1.

#### Scenario: SIGTERM during active requests
- **WHEN** the process receives `SIGTERM` while handling an HTTP request
- **THEN** the in-flight request completes normally AND the server stops accepting new connections AND the Postgres pool is closed AND the process exits with code 0

#### Scenario: Shutdown timeout exceeded
- **WHEN** draining does not complete within 10 seconds after `SIGTERM`
- **THEN** the process force-exits with code 1 and logs a shutdown-timeout warning

### Requirement: Startup DB readiness with retry
Before accepting HTTP traffic, the system SHALL verify Postgres connectivity by running `SELECT 1` with exponential backoff for up to 30 seconds. If the check never succeeds, the process MUST exit with code 1.

#### Scenario: Database becomes available during retry window
- **WHEN** Postgres is unreachable at boot but becomes reachable within 30 seconds
- **THEN** the server starts listening after the first successful probe

#### Scenario: Database unreachable past retry window
- **WHEN** Postgres is unreachable for the full 30-second window
- **THEN** the process exits with code 1 and logs the last connection error

### Requirement: Automated migrations with advisory lock in production
When `MIGRATE_ON_BOOT=true`, the system SHALL acquire a Postgres advisory lock before running Drizzle migrations and release it when migrations finish. If another process holds the lock, the system MUST wait up to 60 seconds; beyond that, it MUST exit with code 1.

#### Scenario: Single replica applies migrations
- **WHEN** one process starts with `MIGRATE_ON_BOOT=true` and pending migrations exist
- **THEN** the advisory lock is acquired, migrations run to completion, the lock is released, and the server starts

#### Scenario: Multiple replicas starting concurrently
- **WHEN** two replicas start simultaneously with `MIGRATE_ON_BOOT=true`
- **THEN** exactly one replica runs the migrations while the other waits, and both eventually start serving traffic without data corruption

#### Scenario: Advisory lock held past timeout
- **WHEN** the advisory lock cannot be acquired within 60 seconds
- **THEN** the process exits with code 1 and logs a lock-acquisition-timeout error

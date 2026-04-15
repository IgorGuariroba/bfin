## ADDED Requirements

### Requirement: Dockerfile healthcheck
The production image SHALL declare a `HEALTHCHECK` instruction that probes `GET http://127.0.0.1:3000/health/live` every 30 seconds, with a 5-second timeout and 3 retries before marking the container unhealthy.

#### Scenario: Container is healthy
- **WHEN** the container is running and `/health/live` responds with 200
- **THEN** `docker inspect` reports the container state as `healthy`

#### Scenario: Application fails liveness probe
- **WHEN** the process stops responding on `/health/live` for 3 consecutive checks
- **THEN** `docker inspect` reports the container state as `unhealthy`

### Requirement: Production compose override
The repository SHALL include a `docker-compose.prod.yml` file usable as an override (`docker compose -f docker-compose.yml -f docker-compose.prod.yml`) that:
- Does NOT publish the Postgres port to the host
- Does NOT reference any committed `.env` file; environment variables MUST be supplied by the deployment environment
- Preserves the API healthcheck and resource limits

#### Scenario: Production compose starts without committed secrets
- **WHEN** an operator runs `docker compose -f docker-compose.yml -f docker-compose.prod.yml up` with all required variables exported in the shell
- **THEN** both containers start successfully AND no secrets are read from a committed `.env` file

#### Scenario: Postgres port is not exposed
- **WHEN** the production compose stack is running
- **THEN** no host port is bound to the Postgres container

### Requirement: Dev compose remains unchanged for local workflow
The existing `docker-compose.yml` SHALL continue to support the local developer workflow via `docker compose up -d --build` with credentials loaded from `.env`, without requiring knowledge of the production override.

#### Scenario: Developer runs dev compose
- **WHEN** a developer with a valid `.env` runs `docker compose up -d --build`
- **THEN** the API and Postgres containers start and `/health/live` returns 200

### Requirement: Deployment documentation
The repository SHALL include `docs/deploy.md` documenting: required environment variables, how to launch the production compose override, how migrations are applied, and smoke-test commands for `/health/live`, `/health/ready`, and `/metrics`.

#### Scenario: Operator follows deploy docs
- **WHEN** an operator follows `docs/deploy.md` step by step on a fresh host
- **THEN** the API is reachable and all three smoke-test commands succeed

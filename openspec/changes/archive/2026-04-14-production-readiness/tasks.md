## 1. Dependencies and env validation

- [x] 1.1 Add `zod`, `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, `fastify-metrics` to `package.json` dependencies
- [x] 1.2 Rewrite `src/config.ts` to parse `process.env` through a Zod schema (required: `DATABASE_URL`, `PORT`, `NODE_ENV`; optional: `CORS_ORIGIN`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`, `MIGRATE_ON_BOOT`, `LOG_LEVEL`)
- [x] 1.3 Make config validation fail the process with a clear error message listing every invalid variable
- [x] 1.4 Update `.env.example` with every new variable and safe defaults

## 2. Fastify hardening

- [x] 2.1 Add `bodyLimit`, `connectionTimeout`, `keepAliveTimeout` to the Fastify factory in `src/app.ts`
- [x] 2.2 Configure Pino `redact` paths in the logger options in `src/app.ts`
- [x] 2.3 Register `@fastify/helmet` with defaults and CSP disabled
- [x] 2.4 Register `@fastify/cors` reading `CORS_ORIGIN` from config
- [x] 2.5 Register `@fastify/rate-limit` reading `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` from config
- [x] 2.6 Register `fastify-metrics` exposing `/metrics`

## 3. Health endpoints

- [x] 3.1 Split `src/routes/health.ts` into `/health/live` (no I/O) and `/health/ready` (runs `SELECT 1` with 2s timeout)
- [x] 3.2 Keep `/health` as alias to `/health/live` with `Deprecation: true` header
- [x] 3.3 Add integration tests in `tests/health.test.ts` for live, ready, ready-with-db-down, and deprecated alias

## 4. Database layer

- [x] 4.1 Update `src/db/index.ts` to export both `db` and the raw `client` and to accept pool options (`max`, `idle_timeout`, `connect_timeout`) from config
- [x] 4.2 Add boot-time retry helper that runs `SELECT 1` with exponential backoff (up to 30s)
- [x] 4.3 Create `src/db/migrate.ts` that wraps `drizzle-orm/postgres-js/migrator` in `pg_advisory_lock` with 60s timeout

## 5. Server lifecycle

- [x] 5.1 In `src/server.ts`, run the boot readiness probe before `app.listen`
- [x] 5.2 If `MIGRATE_ON_BOOT=true`, run `src/db/migrate.ts` after readiness probe and before listening
- [x] 5.3 Register `SIGTERM` and `SIGINT` handlers that call `app.close()` then `client.end()` then `process.exit(0)`, with a 10s hard timeout
- [x] 5.4 Add integration test that sends `SIGTERM` to a running test instance and asserts graceful drain

## 6. Docker and compose

- [x] 6.1 Add `HEALTHCHECK` to `Dockerfile` targeting `/health/live` (install `wget` or use `node -e` probe to avoid new packages)
- [x] 6.2 Create `docker-compose.prod.yml` overriding: remove `ports` from `db`, remove `env_file` from both services, document required env via comments
- [x] 6.3 Verify `docker-compose.yml` still works standalone for dev (smoke test locally)
- [x] 6.4 Run the security audit skill on `Dockerfile`, `docker-compose.yml`, and `docker-compose.prod.yml`

## 7. Tests

- [x] 7.1 Add test for CORS: allowed origin vs denied origin
- [x] 7.2 Add test for rate-limit: 101st request within window returns 429 with `Retry-After`
- [x] 7.3 Add test for body size limit: 2 MB POST returns 413
- [x] 7.4 Add test for log redaction: `Authorization` header appears as `[Redacted]` in logged output
- [x] 7.5 Add test for `/metrics`: returns 200 and contains expected metric families
- [x] 7.6 Add test for migration advisory lock: two concurrent runs do not corrupt state

## 8. Documentation

- [x] 8.1 Create `docs/deploy.md` listing required env vars, production compose command, migration behavior, and smoke-test `curl` commands for `/health/live`, `/health/ready`, `/metrics`
- [x] 8.2 Update `README.md` (or create short section) pointing dev users at `docker compose up -d --build` and prod users at `docs/deploy.md`

## 9. Validation

- [x] 9.1 Run `npm test` and ensure all suites pass
- [x] 9.2 Run `docker compose up -d --build` and manually hit `/health/live`, `/health/ready`, `/metrics`
- [x] 9.3 Run `docker compose -f docker-compose.yml -f docker-compose.prod.yml up` with env exported and repeat smoke tests
- [x] 9.4 Run `/opsx:verify` against this change before archiving

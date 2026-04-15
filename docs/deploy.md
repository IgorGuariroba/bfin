# Deploy Guide

## Required Environment Variables

The following variables are required to run the application in production:

- `DATABASE_URL` — Postgres connection string (e.g. `postgres://user:pass@host:5432/db`)
- `NODE_ENV` — Must be set to `production`
- `PORT` — Application port (default: `3000`)

Optional variables:

- `CORS_ORIGIN` — Allowed CORS origin (default: disabled)
- `RATE_LIMIT_MAX` — Max requests per IP per window (default: `100`)
- `RATE_LIMIT_WINDOW` — Rate limit window in milliseconds (default: `60000`)
- `MIGRATE_ON_BOOT` — Set to `true` to run migrations automatically on startup (default: `false`)
- `LOG_LEVEL` — Pino log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` (default: `info`)
- `DB_POOL_MAX` — Maximum DB pool connections (default: `10`)
- `DB_POOL_IDLE_TIMEOUT` — Idle timeout in seconds (default: `30`)
- `DB_POOL_CONNECT_TIMEOUT` — Connect timeout in seconds (default: `10`)

## Production Docker Compose

Run the production stack using the override file:

```bash
export DATABASE_URL="postgres://..."
export NODE_ENV="production"
export PORT="3000"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Migration Behavior

When `MIGRATE_ON_BOOT=true`, the application acquires a PostgreSQL advisory lock before running migrations. This prevents multiple replicas from executing migrations concurrently. If the lock cannot be acquired within 60 seconds, the boot fails with a clear error.

## Smoke Tests

After deploying, verify the endpoints:

```bash
# Liveness probe (no DB I/O)
curl http://localhost:3000/health/live

# Readiness probe (checks DB connectivity)
curl http://localhost:3000/health/ready

# Prometheus metrics
curl http://localhost:3000/metrics
```

## Security Notes

- Do **not** expose `/metrics` to the public internet. It should be reachable only from your internal monitoring stack or reverse proxy.
- The production override removes `env_file` support; inject secrets via your orchestrator or secrets manager.

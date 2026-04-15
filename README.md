# BFin API

Financial Assistant API built with Fastify, Drizzle ORM, and PostgreSQL.

## Development

Start the local development stack with Docker Compose:

```bash
docker compose up -d --build
```

The API will be available at `http://127.0.0.1:3000`.

## Production Deploy

See [docs/deploy.md](docs/deploy.md) for environment variables, production compose usage, migration behavior, and smoke tests.

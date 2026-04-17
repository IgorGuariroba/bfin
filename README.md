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

## CI & Branch Protection

The CI pipeline, quality gates and branch protection workflow are documented in [docs/ci.md](docs/ci.md).

## MCP server

BFin also ships a second entrypoint — an MCP (Model Context Protocol) server over
STDIO + JSON-RPC 2.0 — that exposes the domain capabilities as tools for MCP
clients (Claude Desktop, Claude Code, etc.). See [docs/mcp.md](docs/mcp.md) for
setup, supported scopes, and the service-account model.

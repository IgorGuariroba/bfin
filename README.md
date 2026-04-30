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

When deploying the MCP HTTP plugin, ensure the following environment variables are set:

| Variable | Example |
|---|---|
| `MCP_HTTP_ENABLED` | `true` |
| `MCP_HTTP_BASE_URL` | `https://api.bfincont.com.br/mcp` |
| `MCP_AUDIENCE_HTTP` | `https://mcp.bfincont.com.br` |
| `MCP_AUTH_SERVER_URL` | `https://bfin.us.auth0.com` |
| `MCP_PROVISIONING_ALLOWED_EMAILS` | `alice@example.com,bob@example.com` |
| `MCP_SESSION_STORE` | `redis` (recommended in prod) |
| `REDIS_URL` | `redis://redis:6379` |

## CI & Branch Protection

The CI pipeline, quality gates and branch protection workflow are documented in [docs/ci.md](docs/ci.md).

## MCP server

BFin exposes a **Remote MCP** at `https://api.bfincont.com.br/mcp` — pluggable
in Claude/ChatGPT via OAuth. It uses HTTP+SSE transport with OAuth 2.1
authentication (Auth0 as the Authorization Server), so users can connect without
installing anything locally.

See [docs/mcp.md](docs/mcp.md) for setup, supported scopes, provisioning, and
troubleshooting.

## Privacy Policy

Our privacy policy is publicly available at
[https://api.bfincont.com.br/privacy](https://api.bfincont.com.br/privacy).

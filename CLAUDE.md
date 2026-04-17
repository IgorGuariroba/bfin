## Regras de segurança
- Sempre que modificar docker-compose.yml, Dockerfile, ou .env,
  rode a skill de auditoria de segurança antes de concluir a tarefa.

## Testes
- **Testes manuais** da API devem ser feitos usando a coleção em `.posting/`.
- **Testes automatizados** devem ser executados com `npm run test` (que roda a suíte vitest dentro do `docker-compose.test.yml`).

## Entrypoints
Este projeto tem dois entrypoints que reutilizam a mesma camada de services:
- **API HTTP** (`src/server.ts`, scripts `dev`/`start`): Fastify + rotas + plugins (auth-guard, account-authorization).
- **MCP server** (`src/mcp/server.ts`, scripts `mcp:dev`/`mcp:start`): STDIO + JSON-RPC 2.0, identidade de service account com escopos OIDC. Documentação em `docs/mcp.md`. O MCP importa apenas de `src/services/*`, `src/db/*` e `src/lib/*` — não depende do Fastify.
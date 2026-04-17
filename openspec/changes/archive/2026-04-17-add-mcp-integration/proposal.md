## Why

Hoje a BFin só é consumida via HTTP/REST autenticado por OIDC. Assistentes de IA (Claude Desktop, Claude Code, etc.) só conseguem interagir com a conta financeira do usuário reimplementando clientes HTTP ou dependendo de integrações ad-hoc. Queremos expor as capacidades financeiras do domínio (contas, categorias, transações, dívidas, metas, projeções, limite diário) como um servidor MCP (Model Context Protocol) sobre STDIO + JSON-RPC 2.0, permitindo que qualquer cliente MCP rode a BFin como ferramenta local — mas sem introduzir um "super user invisível": a identidade do MCP deve ser uma **service account** com escopos restritos e rastreabilidade explícita.

## What Changes

- Adiciona um servidor MCP (STDIO + JSON-RPC 2.0) empacotado como binário Node separado no mesmo monorepo, reutilizando os services/repositórios existentes do domínio (sem passar por HTTP/Fastify).
- Expõe um conjunto inicial de tools MCP cobrindo leitura + escrita do domínio: `accounts.*`, `categories.*`, `transactions.*`, `debts.*`, `goals.*`, `projections.*`, `daily-limit.*`. A lista exata (incluindo quais são read e quais são write) fica definida em `design.md` e nas specs.
- Define um modelo de **service account** para a identidade do MCP:
  - Autenticação via token OIDC fornecido por env/config (validado contra o mesmo provedor do `oidc-integration`), tratado como agente de sistema — **não** como usuário comum.
  - O SA resolve para um `userId` da base (configurado via env) que é o "dono dos writes"; auditoria registra explicitamente `source: "mcp"` para separar dos writes vindos da API HTTP.
- Define **escopos finos** por tool (formato `resource:action`, ex.: `transactions:write`, `accounts:read`). O token do SA declara os escopos concedidos; cada tool valida o escopo necessário antes de invocar o service. Sem escopo ⇒ tool não é exposta via `tools/list` e `tools/call` retorna erro de autorização.
- Define **contexto opcional de usuário final** (`metadata.requestedBy`) aceito nas invocações MCP: usado exclusivamente para enriquecer logs de auditoria — **nunca** para decisão de autorização. A decisão sempre deriva dos escopos do token do SA.
- Adiciona scripts npm (`mcp:start`, `mcp:dev`) e documentação (`docs/mcp.md`) explicando como registrar o servidor em clientes MCP (ex.: Claude Desktop) e como emitir/rotacionar o token da SA.
- **Sem mudanças** em rotas HTTP, em `auth-guard` ou em services do domínio: o MCP é um segundo entrypoint que consome a mesma camada de aplicação por dentro do processo, o que mantém o acoplamento baixo.

## Capabilities

### New Capabilities
- `mcp-server`: servidor MCP sobre STDIO + JSON-RPC 2.0 (handshake `initialize`, `tools/list`, `tools/call`), registry de tools por domínio, mapeamento entre tool e service existente, tratamento padronizado de erros JSON-RPC, logging estruturado por invocação.
- `mcp-service-account`: modelo de identidade de service account para o MCP — validação do token OIDC no bootstrap, extração e enforcement de escopos `resource:action` por tool, resolução do `userId` alvo dos writes, e propagação de `metadata.requestedBy` como contexto **somente de auditoria** para o logger.

### Modified Capabilities
_(nenhuma — o MCP é um segundo entrypoint e não altera o comportamento da API HTTP existente)_

## Impact

- **Novos arquivos**: `src/mcp/server.ts` (entrypoint STDIO), `src/mcp/rpc.ts` (loop JSON-RPC), `src/mcp/tools/` (um arquivo por domínio), `src/mcp/identity.ts` (service account + escopos), `src/mcp/context.ts` (propagação de `requestedBy`), `docs/mcp.md`.
- **Alterado**: `package.json` (scripts `mcp:start`, `mcp:dev`; possível novo `bin`), `README.md` (link para `docs/mcp.md`). Ajuste mínimo em `src/lib/logger.ts` ou equivalente para aceitar `source` e `requestedBy` como campos estruturados padronizados (sem quebrar chamadas existentes).
- **Variáveis de ambiente novas**: `MCP_OIDC_AUDIENCE` (obrigatória, audiência esperada do token do SA), `MCP_SERVICE_ACCOUNT_TOKEN` (obrigatória no runtime do MCP; JWT do SA), `MCP_SUBJECT_USER_ID` (UUID do usuário cujas writes serão atribuídas ao SA).
- **Sem impacto** em runtime da API HTTP: o processo Fastify continua o mesmo. MCP roda como processo separado invocado pelo cliente MCP (STDIO).
- **Segurança**: token do SA nunca é logado; escopos são enforçados antes de chegar ao service; vazamento do token dá acesso **apenas** aos escopos declarados nele (e não a `*:*`).
- **Testes**: suíte nova em `src/mcp/__tests__/` cobrindo handshake JSON-RPC, validação de escopo por tool, rejeição de `requestedBy` como bypass, e integração com ao menos um service real (via testcontainers, seguindo o padrão do projeto).
- **Docker**: nenhuma mudança obrigatória no `docker-compose.yml` (MCP é invocado pelo cliente no host). O `docker-compose.test.yml` ganha cobertura da suíte MCP junto com o restante dos testes.

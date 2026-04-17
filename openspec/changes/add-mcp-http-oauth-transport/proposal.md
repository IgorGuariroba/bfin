## Why

Hoje o MCP (`src/mcp/server.ts`) só expõe transporte **STDIO** — os clientes MCP precisam rodar `node dist/mcp/server.js` localmente, ter acesso direto ao Postgres (`DATABASE_URL`), e colar um `MCP_SERVICE_ACCOUNT_TOKEN` estático nas variáveis de ambiente do seu config.

Esse modelo **não atende ao objetivo do projeto**: queremos que o BFin funcione como um **Conector do Claude** (claude.ai → Settings → Connectors) e em outros clientes Remote-MCP (ChatGPT Apps, Cursor web, mobile, etc.), onde o usuário:

1. Cola uma URL pública do connector no cliente LLM
2. É redirecionado pro fluxo OAuth, faz login (Google), autoriza escopos
3. Começa a usar — sem instalar nada, sem receber credencial do banco, sem config local

O transporte STDIO atual é **incompatível com esse fluxo** porque:

- Exige Node, git, repo clonado, build e reinício manual do cliente em cada máquina do usuário
- Exige credencial direta do Postgres no lado cliente (risco de segurança)
- Não tem fluxo OAuth — token é colado manualmente e expira silenciosamente
- Só funciona com clientes instalados localmente (Desktop/Code/Cursor). `claude.ai` web, mobile, ChatGPT e qualquer Remote-MCP ficam de fora

Esta mudança **substitui** o transporte STDIO pelo HTTP+SSE com OAuth 2.1, atendendo o spec MCP Auth (`2025-06-18`) que os conectores do Claude implementam.

## What Changes

### Substituição do transporte: STDIO → HTTP+SSE

- O arquivo `src/mcp/server.ts` (entrypoint STDIO) é **removido** junto com os scripts `mcp:dev`/`mcp:start` do `package.json`.
- A tool registry (`src/mcp/tools/*`), a camada de autorização (`src/mcp/authz.ts`), o contexto (`src/mcp/context.ts`) e o `buildMcpServer` (`src/mcp/rpc.ts`) são **reutilizados** sem mudança — só troca o transporte.
- Novo transporte: `StreamableHTTPServerTransport` do `@modelcontextprotocol/sdk`, montado como plugin Fastify na API HTTP existente.

### Servidor MCP como OAuth 2.1 Resource Server

O MCP Auth Spec (`2025-06-18`) exige que o servidor MCP atue como Resource Server e delegue a emissão de tokens a um Authorization Server externo. Usaremos **Auth0** como AS:

- `GET /mcp/.well-known/oauth-protected-resource` — metadata do Resource Server (RFC 9728) apontando pro AS do Auth0
- `WWW-Authenticate: Bearer resource_metadata="..."` em `401` para clientes descobrirem o AS
- Aceita apenas Bearer tokens em `Authorization: Bearer <jwt>` (nunca query string)
- Valida JWT contra JWKS do Auth0; exige claims `aud`, `iss`, `exp`, `scope`
- Mapeia `scope` OAuth (espaço-separado, formato `resource:action`) pro `ReadonlySet<string>` usado em `src/mcp/context.ts` e nos handlers de tool

### Dynamic Client Registration (DCR)

Conectores do Claude usam DCR (RFC 7591) pra se registrarem automaticamente no AS. **Auth0 suporta DCR nativamente** (ligar em *Tenant Settings → OIDC Dynamic Application Registration*). Não implementamos o endpoint — apenas configuramos no Auth0.

### Login Google dentro do Auth0

O Auth0 fica configurado com Google como Identity Provider social — o usuário clica "Continuar com Google" no consent screen do Auth0 e volta autenticado. Reusa o OAuth Client já criado em `accounts.google.com` pra este projeto.

### Identidade por request + provisionamento automático

Hoje o MCP tem um `MCP_SUBJECT_USER_ID` fixo em env. No modo HTTP, cada conexão representa um usuário diferente:

- A claim `sub` do JWT vira o `subject` do `ServiceAccount`
- Mantemos a tabela `usuarios.id_provedor` → `usuarios.id`. Se `sub` não existir, o primeiro acesso **provisiona** o usuário (nome/email de claims `name`, `email`)
- `actingUserId` é resolvido dinamicamente por conexão
- Allowlist de emails (`MCP_PROVISIONING_ALLOWED_EMAILS`) controla quem pode ser provisionado automaticamente

### Escopos customizados no Auth0

A API do Auth0 é criada com os mesmos escopos que o MCP já usa (`accounts:read`, `transactions:write`, etc. — ver `docs/mcp.md`). Usuários autorizam esses escopos no consent screen ao plugar o connector.

### Deploy

- A API Fastify (`src/server.ts`) já está em produção via Traefik em `https://api.bfincont.com.br/v2/*`
- As rotas MCP são montadas como plugin Fastify sob `/mcp/*`, ficando publicamente acessíveis em `https://api.bfincont.com.br/v2/mcp/*`
- **URL final do Connector (o que o usuário cola em claude.ai):** `https://api.bfincont.com.br/v2/mcp`

## Capabilities

### New Capabilities

- `mcp-http-transport`: servidor MCP acessível via HTTP+SSE (`StreamableHTTPServerTransport`) como plugin Fastify na API existente, permitindo uso como Remote Connector em LLMs que suportem MCP Auth Spec (`2025-06-18`).
- `mcp-oauth-resource-server`: endpoints de metadata (RFC 9728), validação Bearer JWT contra Authorization Server externo (Auth0), rejeição consistente com `WWW-Authenticate` e mapeamento de scopes OAuth pro modelo interno.
- `mcp-per-request-identity`: resolução dinâmica de `ServiceAccount`/`actingUserId` por token JWT em cada request, com provisionamento automático controlado por allowlist.

### Modified Capabilities

- `mcp-server`: transporte muda de STDIO (removido) pra HTTP+SSE (único). `src/mcp/server.ts` deixa de existir; entrypoint vira o Fastify principal com plugin MCP registrado.
- `mcp-service-account`: `loadServiceAccount` passa a receber token da request em vez de ler de env. A assinatura vira `loadServiceAccountFromToken({ token, validator, provisioning })`. Env vars `MCP_SERVICE_ACCOUNT_TOKEN` e `MCP_SUBJECT_USER_ID` deixam de ser necessárias.
- `oidc-integration`: `src/plugins/oidc.ts` é estendido com helper `validateBearerForMcp(token)` (audience MCP distinta da audience da API HTTP). Nada na validação da API HTTP existente muda.

## Impact

### Novos arquivos

- `src/plugins/mcp-http.ts` — plugin Fastify que registra as rotas MCP e o transporte HTTP+SSE.
- `src/mcp/oauth/bearer-auth.ts` — extração e validação Bearer JWT.
- `src/mcp/oauth/metadata.ts` — handler do `/.well-known/oauth-protected-resource`.
- `src/mcp/oauth/provisioning.ts` — lógica de criar-se-não-existe pra `usuarios` baseado em claim `sub`.
- `src/mcp/session-store.ts` — gerenciamento de sessões MCP (in-memory Map<sessionId, transport>) com TTL.
- `docs/mcp.md` — reescrita: remove instruções STDIO, adiciona guia de plugar no claude.ai como connector.

### Arquivos alterados

- `src/mcp/identity.ts` — `loadServiceAccount` assina apenas `{ token, validator, provisioning }`; remove leitura de `MCP_SERVICE_ACCOUNT_TOKEN`/`MCP_SUBJECT_USER_ID` do env.
- `src/plugins/oidc.ts` — adiciona helper pra audience MCP.
- `src/config.ts` — remove `mcpConfigSchema` STDIO (`MCP_OIDC_AUDIENCE`, `MCP_SERVICE_ACCOUNT_TOKEN`, `MCP_SUBJECT_USER_ID`), adiciona `httpMcpConfigSchema` (`MCP_HTTP_ENABLED`, `MCP_HTTP_BASE_URL`, `MCP_AUDIENCE_HTTP`, `MCP_AUTH_SERVER_URL`, `MCP_PROVISIONING_ALLOWED_EMAILS`).
- `src/server.ts` — registra o plugin `mcp-http` após plugins existentes.
- `package.json` — remove scripts `mcp:dev` e `mcp:start`.

### Arquivos removidos

- `src/mcp/server.ts` — entrypoint STDIO.

### Novas variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `MCP_HTTP_ENABLED` | opcional | `true` para registrar o plugin MCP HTTP (default `true` em produção). Gate por ambiente. |
| `MCP_HTTP_BASE_URL` | ✓ | URL pública onde o MCP está acessível (ex.: `https://api.bfincont.com.br/v2/mcp`). Usado no `resource` da metadata RFC 9728. |
| `MCP_AUDIENCE_HTTP` | ✓ | Audience esperada nos tokens OAuth (ex.: `https://mcp.bfincont.com.br`). Configurada no Auth0 como API Identifier. |
| `MCP_AUTH_SERVER_URL` | ✓ | URL do Authorization Server (Auth0), ex.: `https://bfin.us.auth0.com`. |
| `MCP_PROVISIONING_ALLOWED_EMAILS` | opcional | Lista (CSV ou regex) de emails autorizados a serem provisionados automaticamente. Se vazio, provisionamento é desabilitado (o `sub` precisa já existir em `usuarios`). |

### Variáveis de ambiente removidas

- `MCP_OIDC_AUDIENCE`
- `MCP_SERVICE_ACCOUNT_TOKEN`
- `MCP_SUBJECT_USER_ID`

### Infra

- Nenhuma mudança em Traefik (path `/v2/mcp/*` já roteado pela API HTTP via path-based routing do override `docker-compose.traefik.yml`).
- Nova API no Auth0: `Bfin MCP` com `Audience = https://mcp.bfincont.com.br` e permissions = lista de escopos do MCP.
- Dynamic Client Registration habilitado no tenant Auth0.
- Google como Social Connection no Auth0.

### Segurança

- **Usuários não recebem credencial do banco** — toda comunicação passa pelo servidor, que valida escopos antes de qualquer query.
- Sem impacto na API HTTP existente: segue funcionando com OIDC Google como está. Os tokens OAuth do MCP são emitidos pelo Auth0 (audience própria, sem cross-scope com a API HTTP).
- Provisionamento automático controlado por `MCP_PROVISIONING_ALLOWED_EMAILS`. Se vazio, admin precisa inserir o `usuarios` manualmente antes do primeiro login.
- Tokens respeitam `exp`; revogação via Auth0 console (revoga o grant → próxima request do cliente volta 401 → Claude força reauth).

### Breaking changes

- Quem usa MCP STDIO hoje (se houver usuário ativo nesse modo) **perde esse modo**. Considerando que o projeto ainda não está em produção como connector, o impacto é zero em relação à base ativa.
- Variáveis `MCP_OIDC_AUDIENCE`, `MCP_SERVICE_ACCOUNT_TOKEN`, `MCP_SUBJECT_USER_ID` deixam de ser lidas — remover do `.env` em deploys existentes (sem erro, só ficam ignoradas).

## Ordem de execução sugerida

1. Configuração Auth0 (tenant, API `Bfin MCP`, permissions, DCR, Google social)
2. Fundação de código OAuth (bearer-auth, metadata, provisioning, validator)
3. Plugin Fastify `mcp-http` com transporte HTTP+SSE e sessões
4. Remoção do STDIO (`src/mcp/server.ts`, scripts, env vars antigas)
5. Testes locais com MCP Inspector + token Auth0 de dev
6. Deploy na VPS (rebuild imagem, atualizar `.env`)
7. Plugar no claude.ai (connectors) e validar fluxo completo
8. Documentação (`docs/mcp.md` reescrita)

Detalhamento em `tasks.md`.

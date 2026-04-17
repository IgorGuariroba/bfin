## Why

Hoje o MCP (`src/mcp/server.ts`) só expõe transporte **STDIO** — os clientes MCP precisam rodar `node dist/mcp/server.js` localmente e colar um `MCP_SERVICE_ACCOUNT_TOKEN` (JWT emitido manualmente) nas variáveis de ambiente do seu config. Isso limita o uso a Claude Desktop, Claude Code e outros clientes instalados localmente, com três problemas operacionais críticos:

1. **Dor operacional**: cada máquina (notebook de casa, do trabalho, outro colaborador) precisa clonar o repo, instalar deps, buildar e configurar o JSON do cliente com token + `DATABASE_URL` + `OIDC_ISSUER_URL`. Tokens expirados quebram silenciosamente.
2. **Rotação manual**: o token vive em arquivo de config local. Sem um fluxo OAuth, revogação/rotação é manual e propensa a erro.
3. **Não suporta Conectores do Claude** (claude.ai/settings/connectors) nem ChatGPT Apps/Custom GPTs nem nenhum cliente Remote MCP. Esses clientes exigem **HTTP + SSE + OAuth 2.1** com Dynamic Client Registration (DCR) e descoberta via Protected Resource Metadata (PRM, RFC 9728).

O objetivo desta mudança é **permitir que o MCP do BFin seja plugado como Remote Connector em qualquer LLM moderna** (claude.ai web, mobile, ChatGPT, Cursor, etc.) via fluxo OAuth padrão, sem comprometer o uso STDIO local existente (para quem ainda quiser).

## What Changes

### Novo transporte HTTP+SSE para o MCP

- Adiciona `StreamableHTTPServerTransport` do `@modelcontextprotocol/sdk` como segundo transporte do MCP, ao lado do STDIO atual.
- Cria um novo entrypoint `src/mcp/http-server.ts` que:
  - Inicia um servidor Fastify dedicado (ou monta sob o Fastify existente) expondo `POST /mcp` e `GET /mcp/sse`.
  - Valida JWT OAuth em cada conexão e resolve a identidade do chamador para o mesmo `ServiceAccount` usado hoje pelo STDIO.
  - Mantém um ciclo de vida de sessão por conexão SSE (Model Context Protocol session IDs).
- O entrypoint STDIO (`src/mcp/server.ts`) permanece inalterado em comportamento externo (usuários que já usam MCP local seguem com o mesmo fluxo; a mudança de auth do STDIO fica fora do escopo).

### OAuth 2.1 Resource Server conforme MCP Auth Spec

O MCP Auth Spec (`2025-06-18`) exige que o servidor MCP atue como **OAuth 2.1 Resource Server** e delegue a emissão de tokens a um Authorization Server externo. Escolhemos **Auth0** como AS:

- `GET /.well-known/oauth-protected-resource` — metadata do Resource Server (RFC 9728) apontando para o AS do Auth0.
- `WWW-Authenticate: Bearer resource_metadata="..."` em `401` para clientes descobrirem o AS.
- Aceita apenas Bearer tokens no header `Authorization: Bearer <jwt>`; nunca na query string.
- Valida JWT contra JWKS do Auth0; exige claims `aud`, `iss`, `exp`, `scope`.
- Mapeia `scope` OAuth (espaço-separado, formato `resource:action`) para o `ReadonlySet<string>` usado em `src/mcp/context.ts` e nos handlers de tool.

### Dynamic Client Registration (DCR)

Conectores do Claude usam DCR (RFC 7591) para se registrarem automaticamente no AS. **Auth0 suporta DCR nativamente** (ligar em *Tenant Settings → OIDC Dynamic Application Registration*). Não precisaremos implementar o endpoint — apenas configurar.

### Mapeamento de identidade por token

Hoje o MCP tem um único `MCP_SUBJECT_USER_ID` fixo em env. No modo HTTP, cada conexão representa um usuário diferente:

- A claim `sub` do JWT vira o `subject` do `ServiceAccount`.
- A API mantém uma tabela `usuarios.id_provedor` → `usuarios.id`. Se o `sub` não existir, o primeiro acesso **provisiona** o usuário (nome/email vêm de claims adicionais `name`, `email` — opcional).
- `actingUserId` é resolvido dinamicamente por conexão em vez de carregado no bootstrap.

### Escopos customizados no Auth0

A API do Auth0 é criada com os mesmos escopos que o MCP já usa (`accounts:read`, `transactions:write`, etc. — ver `docs/mcp.md`). Usuários autorizam esses escopos no consent screen do Auth0 ao plugar o connector.

### Login social via Google dentro do Auth0

O Auth0 fica configurado com Google como Identity Provider social — usuários clicam "Login with Google" no consent screen do Auth0 e voltam autenticados. Isso reutiliza o credencial Google que já foi criada em `accounts.google.com` para este projeto.

### Modo STDIO preservado

- Entrypoint `src/mcp/server.ts` (scripts `mcp:dev`/`mcp:start`) segue funcionando com `MCP_SERVICE_ACCOUNT_TOKEN` estático.
- `loadServiceAccount` em `src/mcp/identity.ts` é refatorado para aceitar dois modos: (a) token do env (STDIO, comportamento atual) e (b) token de request HTTP (novo modo).

### Deploy

- A API HTTP (Fastify) já está em produção via Traefik em `https://api.bfincont.com.br/v2/*`. As rotas MCP serão montadas sob `/v2/mcp/*` (path-based routing existente, zero mudança de infra).
- **URL final do Connector**: `https://api.bfincont.com.br/v2/mcp` (endpoint `POST`) e `https://api.bfincont.com.br/v2/mcp/sse` (stream GET).

## Capabilities

### New Capabilities

- `mcp-http-transport`: servidor MCP acessível via HTTP+SSE (`StreamableHTTPServerTransport`) como segundo transporte, permitindo uso como Remote Connector em LLMs que suportem MCP Auth Spec (2025-06-18).
- `mcp-oauth-resource-server`: endpoints de metadata (RFC 9728), validação Bearer JWT contra Authorization Server externo (Auth0), e rejeição consistente com `WWW-Authenticate`.
- `mcp-per-request-identity`: resolução dinâmica de `ServiceAccount`/`actingUserId` por token JWT em cada request HTTP, com provisionamento automático na primeira entrada.

### Modified Capabilities

- `mcp-server`: ganha um segundo entrypoint HTTP (`src/mcp/http-server.ts`) e scripts `mcp:http:dev`/`mcp:http:start`. Comportamento STDIO preservado.
- `mcp-service-account`: refatoração de `loadServiceAccount` para aceitar token via env (STDIO) ou via request (HTTP). Cria-se `loadServiceAccountFromToken(token)` reutilizado pelos dois modos.
- `oidc-integration`: `src/plugins/oidc.ts` é estendido para expor um helper `validateBearerForMcp(token)` que valida audience/scope MCP (distinta da audience da API HTTP existente).

## Impact

### Novos arquivos

- `src/mcp/http-server.ts` — entrypoint HTTP do MCP.
- `src/mcp/http-transport.ts` — wrapper em torno de `StreamableHTTPServerTransport` com auth middleware.
- `src/mcp/oauth/metadata.ts` — handler do `/.well-known/oauth-protected-resource`.
- `src/mcp/oauth/bearer-auth.ts` — extração e validação Bearer JWT.
- `src/mcp/oauth/provisioning.ts` — lógica de criar-se-não-existe para `usuarios` baseado em claim `sub`.
- `docs/mcp-http.md` — guia de deploy e de como plugar em Claude/ChatGPT como connector.

### Arquivos alterados

- `src/mcp/identity.ts` — split em `loadServiceAccountFromEnv` (STDIO) e `loadServiceAccountFromToken` (HTTP) reutilizando o mesmo core.
- `src/mcp/server.ts` — sem mudança funcional; permanece STDIO.
- `src/plugins/oidc.ts` — adiciona helper para audience MCP.
- `src/config.ts` — adiciona schema `httpMcpConfigSchema` com `MCP_HTTP_PORT`, `MCP_HTTP_BASE_URL`, `MCP_AUDIENCE_HTTP`, `OIDC_ISSUER_URL` (já existe).
- `src/server.ts` (API HTTP) — opcional: montar as rotas MCP sob o mesmo servidor Fastify em `/mcp/*` em vez de processo separado (decisão no task 2.x).
- `package.json` — novos scripts `mcp:http:dev` e `mcp:http:start`; dependência `@modelcontextprotocol/sdk` já existe.
- `docker-compose.yml` e `docker-compose.prod.yml` — expor porta adicional para MCP HTTP se rodar processo separado (se montar no Fastify existente, sem mudança).
- `docs/mcp.md` — link para `docs/mcp-http.md` e nota sobre quando usar cada transporte.

### Novas variáveis de ambiente

| Variável | Obrigatória no modo HTTP | Descrição |
|---|---|---|
| `MCP_HTTP_ENABLED` | opcional | `true` para subir o transporte HTTP (default `false`). Permite gate por ambiente. |
| `MCP_HTTP_BASE_URL` | ✓ | URL pública onde o MCP HTTP está acessível (ex.: `https://api.bfincont.com.br/v2/mcp`). Usado no `resource` da metadata RFC 9728. |
| `MCP_AUDIENCE_HTTP` | ✓ | Audience esperado nos tokens OAuth (ex.: `https://mcp.bfincont.com.br`). Configurado no Auth0 como API Identifier. |
| `MCP_AUTH_SERVER_URL` | ✓ | URL do Authorization Server (Auth0), ex.: `https://bfin.us.auth0.com`. |
| `MCP_PROVISIONING_ALLOWED_EMAILS` | opcional | Lista (CSV ou regex) de emails autorizados a serem provisionados. Se vazio, provisionamento automático é desabilitado e `sub` precisa já existir. |

### Infra

- Nenhuma mudança em Traefik (path `/v2/mcp/*` já roteado pela API HTTP existente).
- Nova API no Auth0: `Bfin MCP` com `Audience = https://mcp.bfincont.com.br` e permissions = lista de escopos do MCP.
- Dynamic Client Registration habilitado no tenant Auth0.
- Google como Social Connection no Auth0 (reusa OAuth Client já criado em Google Cloud).

### Segurança

- Sem impacto em produção atual: API HTTP segue funcionando com OIDC Google como está. Os tokens OAuth do MCP são emitidos pelo Auth0 (separado). A validação MCP usa audience própria, não vaza acesso pra API HTTP.
- Provisionamento automático é um risco — por isso `MCP_PROVISIONING_ALLOWED_EMAILS` ou desabilitado por padrão. Em produção, provisionar usuários apenas via backoffice e exigir que `sub` já exista.
- Tokens OAuth têm `exp` respeitado; revogação via Auth0 console.

### Sem impacto

- Clientes STDIO existentes (Claude Desktop/Code com config local) seguem funcionando sem mudança.
- Demais rotas da API HTTP (`/accounts`, `/transactions`, etc.) não tocam no novo código OAuth MCP.
- Banco: sem migrations novas; reusa `usuarios` existente.

## Ordem de execução sugerida

1. Configuração Auth0 (criar tenant, API `Bfin MCP`, permissions, DCR, Google social).
2. Fundação de código (split de `identity.ts`, novos módulos OAuth, metadata endpoint).
3. Transporte HTTP no Fastify existente, por trás de flag `MCP_HTTP_ENABLED`.
4. Testes locais com `curl` + `mcp-inspector`.
5. Deploy em VPS (rebuild imagem, atualizar `.env`).
6. Plugar no Claude (claude.ai/settings/connectors) e validar fluxo completo.
7. Documentar em `docs/mcp-http.md` + revisão final.

Detalhamento em `tasks.md`.

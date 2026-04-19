## 1. Configuração Auth0

- [ ] 1.1 Criar tenant Auth0 em região US; anotar domain (ex: `bfin.us.auth0.com`)
- [ ] 1.2 Configurar Branding (nome app `Bfin`, email de suporte, email dev, adicionar domínio autorizado `bfincont.com.br`)
- [ ] 1.3 Em **Authentication → Social**, adicionar **Google** desligando "Auth0 Dev Keys" e colando o Client ID/Secret do OAuth Client já criado em `accounts.google.com`
- [ ] 1.4 Criar API no Auth0:
  - Name: `Bfin MCP`
  - Identifier (audience): `https://mcp.bfincont.com.br`
  - Signing Algorithm: **RS256**
  - Allow Offline Access: **on** (pra refresh tokens)
- [ ] 1.5 Na aba **Permissions** da API `Bfin MCP`, adicionar todos os escopos listados em `docs/mcp.md`: `accounts:read`, `accounts:write`, `account-members:read`, `categories:read`, `categories:write`, `transactions:read`, `transactions:write`, `debts:read`, `debts:write`, `goals:read`, `goals:write`, `daily-limit:read`, `daily-limit:write`, `projections:read`
- [ ] 1.6 Habilitar **Dynamic Application Registration** em **Tenant Settings → Advanced** (`flags.enable_dynamic_application_registration = true`)
- [ ] 1.7 Em **Tenant Settings → Advanced → Default Audience**, definir `https://mcp.bfincont.com.br` (facilita clients que não passam audience explicitamente)
- [ ] 1.8 Em **Tenant Settings → Advanced → Promote Connections to Domain Level**, habilitar **Google** pra que DCR-registered clients possam usar login Google
- [ ] 1.9 Criar uma aplicação **Regular Web Application** de teste (`bfin-mcp-dev`) autorizada pra API `Bfin MCP` — será usada pra obter tokens de teste via Authorization Code flow durante desenvolvimento
- [x] 1.10 Documentar todos os valores finais (domain, audience, issuer URL, scopes) em arquivo interno `.env.auth0.example` (não commitar secrets)

## 2. Fundação de código OAuth

- [x] 2.1 Atualizar `src/config.ts`:
  - Remover `mcpConfigSchema` e export `loadMcpConfig`
  - Adicionar `httpMcpConfigSchema`:
    ```ts
    z.object({
      MCP_HTTP_ENABLED: z.enum(["true", "false"]).default("true"),
      MCP_HTTP_BASE_URL: z.string().url(),
      MCP_AUDIENCE_HTTP: z.string().url(),
      MCP_AUTH_SERVER_URL: z.string().url(),
      MCP_PROVISIONING_ALLOWED_EMAILS: z.string().optional()
    })
    ```
  - Export `loadHttpMcpConfig()` com parse + erros claros
- [x] 2.2 Criar `src/mcp/oauth/bearer-auth.ts`:
  - `extractBearerToken(req: FastifyRequest): string | null` — lê `Authorization: Bearer <token>`, retorna null se ausente ou malformado
  - `buildWwwAuthenticateHeader(resourceUrl: string, error?: string): string` — monta `Bearer resource_metadata="<resourceUrl>/.well-known/oauth-protected-resource"` + opcional `error="invalid_token"`
- [x] 2.3 Criar `src/mcp/oauth/metadata.ts`:
  - Handler Fastify que retorna JSON conforme RFC 9728:
    ```json
    {
      "resource": "https://api.bfincont.com.br/mcp",
      "authorization_servers": ["https://bfin.us.auth0.com"],
      "bearer_methods_supported": ["header"],
      "scopes_supported": ["accounts:read", "..."],
      "resource_documentation": "https://api.bfincont.com.br/mcp/docs"
    }
    ```
  - Lê URL base da config, lista estática de scopes de `src/mcp/tools/index.ts`
- [x] 2.4 Estender `src/lib/oidc-jwks.ts` (ou criar `src/lib/oidc-mcp.ts`):
  - `createMcpJwtVerifier({ issuerUrl, audience })` reutilizando a infra JWKS existente
  - Retorna `{ verify(token): Promise<{ sub, email?, name?, scopes: Set<string> }> }`
  - Extração de scope do claim `scope` (string) ou `permissions` (array) — Auth0 usa ambos
- [x] 2.5 Criar `src/mcp/oauth/provisioning.ts`:
  - `isEmailAllowed(email, allowlistRaw): boolean` — parse de CSV ou regex
  - `resolveUserFromClaims(claims, { allowlistRaw, logger }): Promise<string>`:
    - Busca `usuarios.id_provedor = claims.sub`; se existir, retorna `usuarios.id`
    - Se não existir e email passa na allowlist: cria `usuarios (id_provedor, email, nome)` e retorna id (log de provisioning)
    - Caso contrário: lança `ServiceAccountBootstrapError("USER_NOT_FOUND")`

## 3. Refatoração de identidade

- [x] 3.1 Refatorar `src/mcp/identity.ts`:
  - Remover leitura de `mcpConfig.serviceAccountToken` e `mcpConfig.subjectUserId`
  - Nova assinatura: `loadServiceAccountFromToken({ token, verifier, provisioning }): Promise<ServiceAccount>`
  - Usa `verifier.verify(token)` + `resolveUserFromClaims(payload, provisioning)` + mesmo `parseScopes` que existe
  - Mantém tipo `ServiceAccount` e class `ServiceAccountBootstrapError` sem mudança
- [x] 3.2 Atualizar testes existentes (`tests/mcp/identity.test.ts`) pra nova assinatura; adicionar casos de usuário inexistente com e sem allowlist

## 4. Plugin Fastify HTTP+SSE

- [x] 4.1 Criar `src/mcp/session-store.ts`:
  - `Map<string, { transport: StreamableHTTPServerTransport, sa: ServiceAccount, createdAt: number, lastActivity: number }>`
  - `createSession(sa)`, `getSession(id)`, `touchSession(id)`, `closeSession(id)`, `cleanupExpired()` (chamado em `setInterval` 60s, TTL 10min)
- [x] 4.2 Criar `src/plugins/mcp-http.ts` encapsulado via `fastify-plugin`:
  - Lê `loadHttpMcpConfig()`; se `MCP_HTTP_ENABLED=false`, não registra nada
  - Inicializa `createMcpJwtVerifier` uma vez no startup
  - Registra rotas:
    - `GET /mcp/.well-known/oauth-protected-resource` → metadata handler (sem auth)
    - `POST /mcp` → handler de requests MCP
    - `GET /mcp/sse` → handler de stream SSE
    - `DELETE /mcp/sse/:sessionId` → fecha sessão manualmente
- [x] 4.3 Implementar auth middleware aplicado a `POST /mcp` e `GET /mcp/sse`:
  - `extractBearerToken(req)` → null? reply 401 com `WWW-Authenticate` e body `{error: "invalid_token"}`
  - `verifier.verify(token)` → falha? reply 401 com `WWW-Authenticate` contendo `error="invalid_token"` ou `error="expired_token"` conforme o caso
  - `loadServiceAccountFromToken` → `USER_NOT_FOUND`? reply 403 (não é erro de auth, é autorização)
  - Sucesso: anexa `request.mcpSa` (via decoration Fastify) e segue
- [x] 4.4 Implementar `POST /mcp`:
  - Lê header `Mcp-Session-Id`; se ausente, cria nova sessão com `sessionStore.createSession(sa)`
  - Monta `McpServer` via `buildMcpServer({ sa, registry: buildToolRegistry(sa), logger })`
  - Conecta o `StreamableHTTPServerTransport` da sessão
  - Delega `req.raw` e `reply.raw` pro `transport.handleRequest(...)` (stream bidirecional)
- [x] 4.5 Implementar `GET /mcp/sse`:
  - Exige `Mcp-Session-Id` válido; senão 400
  - Acopla SSE stream ao transport da sessão existente
- [x] 4.6 Implementar `DELETE /mcp/sse/:sessionId`:
  - `sessionStore.closeSession(id)` + `transport.close()` + 204
- [x] 4.7 Registrar o plugin em `src/server.ts` após os plugins existentes (auth-guard, account-authorization)

## 5. Remoção do STDIO

- [x] 5.1 Deletar `src/mcp/server.ts`
- [x] 5.2 Remover scripts `mcp:dev`, `mcp:start`, `mcp:test:stdio` (se existir) do `package.json`
- [x] 5.3 Atualizar `tsconfig.json` `include` se referenciar explicitamente `src/mcp/server.ts`
- [x] 5.4 Remover `loadMcpConfig` dos imports de qualquer arquivo que ainda use
- [x] 5.5 Atualizar `.env.example` removendo `MCP_OIDC_AUDIENCE`, `MCP_SERVICE_ACCOUNT_TOKEN`, `MCP_SUBJECT_USER_ID` e adicionando as novas variáveis `MCP_HTTP_*`

## 6. Testes

- [x] 6.1 Unit: `tests/mcp/oauth/bearer-auth.test.ts` — header ausente, header malformado, token válido extraído, header case-insensitive
- [x] 6.2 Unit: `tests/mcp/oauth/metadata.test.ts` — formato RFC 9728 correto com todos os campos; URL base vindo da config
- [x] 6.3 Unit: `tests/mcp/oauth/provisioning.test.ts` — três casos:
  - Usuário existente em `id_provedor` → retorna id
  - Não existe, email passa na allowlist → cria e retorna id
  - Não existe, email fora da allowlist → lança `USER_NOT_FOUND`
- [x] 6.4 Unit atualizado: `tests/mcp/identity.test.ts` — cobertura de `loadServiceAccountFromToken` (happy path + token inválido + claims sem sub)
- [x] 6.5 Integração: `tests/mcp/http-transport.int.test.ts` — sobe Fastify com plugin MCP HTTP ativado, mocka verifier:
  - `GET /mcp/.well-known/oauth-protected-resource` → 200 com campos RFC 9728
  - `POST /mcp` sem token → 401 + `WWW-Authenticate`
  - `POST /mcp` com token inválido → 401 + `WWW-Authenticate`
  - `POST /mcp` com token válido (método `initialize`) → 200 + `Mcp-Session-Id` header
  - `POST /mcp` com `Mcp-Session-Id` válido + método `tools/list` → 200 + lista de tools dentro do scope
  - `DELETE /mcp/sse/:id` → 204
- [x] 6.6 E2E manual: script `scripts/test-mcp-http.sh`:
  - Obtém token via client credentials do Auth0
  - Testa metadata, 401, initialize, tools/list, session termination e CORS preflight
  - Valida `Mcp-Session-Id` no header e confere que `mcp.whoami` aparece

## 7. Operação: CORS, rate limit, erros, auditoria, sessões

- [x] 7.0 **CORS**: o cliente claude.ai é `https://claude.ai`. Registrar `@fastify/cors` (se ainda não estiver) com allowlist explícita `["https://claude.ai", "https://app.claude.com", "http://localhost:*"]` aplicada **apenas** às rotas `/mcp/*`. Sem CORS correto, o browser do Claude não consegue sequer fazer o preflight. Incluir `OPTIONS /mcp` e `OPTIONS /mcp/sse`
- [x] 7.1 **Rate limit**: `@fastify/rate-limit` com buckets diferentes:
  - `/mcp/.well-known/*`: 60 req/min por IP (público)
  - `/mcp` e `/mcp/sse` autenticados: 120 tool calls/min **por `sub` do JWT** (não por IP, para não punir usuários atrás do mesmo NAT)
- [x] 7.2 **Mapeamento de erros de negócio → JSON-RPC**: criar `src/mcp/errors.ts` que traduz:
  - `BusinessRuleError` → `{ code: -32602, message }` (Invalid params)
  - `NotFoundError` → `{ code: -32001, message, data: { type: "not_found" } }`
  - `SystemGeneratedResourceError` → `{ code: -32003, message }`
  - Qualquer outro → `{ code: -32603, message: "Internal error" }` (e loga o erro cru em stderr)
  - Ligar no `rpc.ts` via interceptor que envolve `handler()` de cada tool
- [x] 7.3 **Audit log** (obrigatório em projeto financeiro): cada chamada de tool registra em `pino` (nível `info`) um evento estruturado:
  - `ts`, `userId`, `sub`, `tool`, `scope`, `sessionId`, `durationMs`, `outcome` (success/error), `errorCode` (se houver), `inputHash` (hash SHA256 do payload, não o payload cru — evita logar CPF, valores, etc.)
  - Em `docs/mcp.md`, explicar como buscar por `userId` no `docker logs`
- [x] 7.4 **Session store Redis** (Redis roda como serviço `redis` no `docker-compose.yml` da nova VPS): criar `src/mcp/session-store-redis.ts` implementando a mesma interface de `session-store.ts`; habilitado por `MCP_SESSION_STORE=redis` (default `memory` em dev, `redis` em prod). Sessões resistem a restart e permitem escalar horizontalmente se a VPS crescer
- [ ] 7.5 **Descrições de scopes no Auth0**: em cada permission criada no step 1.5, preencher o campo **Description** com texto amigável em português (ex.: `accounts:read` → "Ver suas contas bancárias e cartões"). Isso aparece no consent screen do Auth0 que o usuário vê ao conectar — é a última chance de deixar claro o que o connector acessa
- [x] 7.6 **Métricas Prometheus**: estender `/metrics` (autenticado via `METRICS_TOKEN`) com:
  - `bfin_mcp_tool_calls_total{tool, outcome}`
  - `bfin_mcp_tool_duration_seconds{tool}` (histogram)
  - `bfin_mcp_active_sessions`
  - `bfin_mcp_auth_failures_total{reason}` (token ausente, expirado, inválido, user não provisionado)
- [x] 7.7 **LGPD/GDPR — direito ao esquecimento**: adicionar comando `npm run mcp:delete-user -- --email=<email>` que:
  - Encontra `usuarios.id_provedor = email`
  - Remove user do Auth0 via Management API
  - Deleta `usuarios` e tudo em cascade (ou bloqueia se tiver `contas` com coproprietários)
  - Registra ação no audit log
- [x] 7.8 **Revogação**: documentar em `docs/mcp.md` o fluxo:
  - Usuário quer desconectar → remove connector no claude.ai
  - Admin quer revogar → Auth0 Dashboard → Applications → deleta o app criado via DCR; ou Users → Revoke Grants

## 8. Deploy na nova VPS (Caddy)

### 8.a Provisionamento da VPS

- [ ] 8.a.1 Contratar/escolher VPS (Ubuntu 22.04 LTS ou superior, 2GB RAM mínimo, 1 vCPU) e anotar IP público
- [ ] 8.a.2 Apontar DNS `api.bfincont.com.br` (registro `A`) para o IP da VPS. **Aguardar propagação** (checar com `dig +short api.bfincont.com.br @8.8.8.8`) antes de subir o Caddy — ACME falha sem DNS
- [ ] 8.a.3 SSH hardening: usuário não-root com sudo, login por chave apenas (desabilitar `PasswordAuthentication`), UFW liberando apenas `22/tcp`, `80/tcp` e `443/tcp`
- [ ] 8.a.4 Instalar Docker Engine + Compose plugin via script oficial (`get.docker.com`)

### 8.b Estrutura do projeto na VPS

- [ ] 8.b.1 Criar diretório `/opt/bfin/` com subpastas `caddy/`, `data/postgres/`, `data/redis/`, `data/caddy/`
- [ ] 8.b.2 Clonar repo em `/opt/bfin/app` (branch `master`) e criar `/opt/bfin/.env` com:
    ```
    NODE_ENV=production
    DATABASE_URL=postgres://bfin:<senha-forte>@postgres:5432/bfin
    REDIS_URL=redis://redis:6379

    # OIDC da API HTTP (mantém como hoje, mesmo que ainda não exposta publicamente)
    OIDC_ISSUER_URL=<mesmo de hoje>
    OIDC_AUDIENCE=<mesmo de hoje>

    # MCP HTTP
    MCP_HTTP_ENABLED=true
    MCP_HTTP_BASE_URL=https://api.bfincont.com.br/mcp
    MCP_AUDIENCE_HTTP=https://mcp.bfincont.com.br
    MCP_AUTH_SERVER_URL=https://bfin.us.auth0.com
    MCP_PROVISIONING_ALLOWED_EMAILS=1g0r.guari@gmail.com
    MCP_SESSION_STORE=redis

    METRICS_TOKEN=<gerar com `openssl rand -hex 32`>
    ```
- [ ] 8.b.3 Garantir permissões: `chmod 600 /opt/bfin/.env` e `chown root:root` (ou usuário de deploy dedicado)

### 8.c docker-compose.yml novo (api + postgres + redis + caddy)

- [x] 8.c.1 Criar `/opt/bfin/app/docker-compose.vps.yml` com 4 serviços:
  - `api`: build do Dockerfile existente, sem portas publicadas no host, `env_file: /opt/bfin/.env`, `depends_on: [postgres, redis]`, restart `unless-stopped`
  - `postgres`: imagem `postgres:16-alpine`, volume `/opt/bfin/data/postgres:/var/lib/postgresql/data`, sem portas publicadas, `POSTGRES_*` no `.env`
  - `redis`: imagem `redis:7-alpine`, volume `/opt/bfin/data/redis:/data`, sem portas publicadas, `--appendonly yes`
  - `caddy`: imagem `caddy:2.8-alpine`, portas `80:80` e `443:443`, volumes `/opt/bfin/caddy/Caddyfile:/etc/caddy/Caddyfile:ro` e `/opt/bfin/data/caddy:/data`
- [x] 8.c.2 **Rodar a skill de auditoria de segurança** sobre o novo `docker-compose.vps.yml` e o `Dockerfile`. Findings corrigidos:
  - Adicionados headers de segurança no Caddyfile (X-Frame-Options, Referrer-Policy, CSP)
  - Adicionado healthcheck no Redis e alterado `depends_on` para `condition: service_healthy`
  - Adicionado `cap_drop: ALL` e `security_opt: no-new-privileges:true` no Postgres
  - Pin da imagem Caddy para `2.8-alpine`
- [x] 8.c.3 Criar `/opt/bfin/caddy/Caddyfile` inicial expondo **apenas** o MCP:
    ```
    {
        email <email-admin>@bfincont.com.br
    }

    api.bfincont.com.br {
        encode zstd gzip

        # só /mcp/* é público nesta fase
        handle_path /mcp/* {
            reverse_proxy api:3000 {
                flush_interval -1   # SSE streaming sem buffering
            }
            header +Strict-Transport-Security "max-age=31536000; includeSubDomains"
            header +X-Content-Type-Options "nosniff"
        }

        # qualquer outra rota → 404 controlado
        handle {
            respond "Not found" 404
        }
    }
    ```

### 8.d Subida e validação

- [ ] 8.d.1 Build e up: `cd /opt/bfin/app && docker compose -f docker-compose.prod.yml --env-file /opt/bfin/.env up -d --build`
- [ ] 8.d.2 Rodar migrations pela primeira vez: `docker compose -f docker-compose.prod.yml exec api npm run migrate:deploy`
- [ ] 8.d.3 Conferir logs: `docker compose -f docker-compose.prod.yml logs caddy api --tail 100` — Caddy deve imprimir `certificate obtained successfully`
- [ ] 8.d.4 Validar metadata: `curl -s https://api.bfincont.com.br/mcp/.well-known/oauth-protected-resource | jq` — JSON RFC 9728 válido
- [ ] 8.d.5 Validar 401 sem token: `curl -i -X POST https://api.bfincont.com.br/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'` — status 401 e header `WWW-Authenticate: Bearer resource_metadata="..."`
- [ ] 8.d.6 Validar CORS preflight: `curl -i -X OPTIONS https://api.bfincont.com.br/mcp -H 'Origin: https://claude.ai' -H 'Access-Control-Request-Method: POST'` — headers `Access-Control-Allow-Origin` e `Access-Control-Allow-Methods` corretos
- [ ] 8.d.7 Validar que rotas não-MCP estão fechadas: `curl -i https://api.bfincont.com.br/v2/contas` → esperar `404 Not found` vindo do Caddy (não do Fastify)
- [ ] 8.d.8 Validar TLS: `curl -I https://api.bfincont.com.br/mcp` — cert válido Let's Encrypt, `HTTP/2` (ou `HTTP/3`)
- [ ] 8.d.9 Validar que Redis tem sessões ativas após um teste E2E: `docker compose -f docker-compose.prod.yml exec redis redis-cli KEYS 'mcp:session:*'`

## 9. Integração com clientes MCP

- [ ] 9.1 **MCP Inspector (debug)**: `npx @modelcontextprotocol/inspector`, adicionar connector URL `https://api.bfincont.com.br/mcp`, token do step 6.6, validar `tools/list`
- [ ] 9.2 **claude.ai Connectors** (fluxo principal):
  - claude.ai → Settings → Connectors → **Add custom connector**
  - URL: `https://api.bfincont.com.br/mcp`
  - Claude detecta metadata (RFC 9728) → inicia OAuth Authorization Code + PKCE
  - Registra novo client no Auth0 via DCR automaticamente
  - Redireciona pro Auth0 → usuário clica "Continuar com Google"
  - Consent screen mostra escopos solicitados → **Authorize**
  - Connector aparece como **Connected**
  - Em uma conversa: ativa o connector, testa `list my transactions from last month`
- [ ] 9.3 Validar revogação:
  - Auth0 Dashboard → Applications → remover o app criado via DCR
  - Próxima request do Claude retorna 401 → Claude reinicia OAuth flow
- [ ] 9.4 Validar com segundo usuário (opcional):
  - Adicionar segundo email em `MCP_PROVISIONING_ALLOWED_EMAILS`
  - Rebuild/restart
  - Testar que ele consegue conectar e suas actions vão como identidade própria

## 10. Documentação

- [x] 10.1 Reescrever `docs/mcp.md` do zero:
  - Arquitetura (MCP como Resource Server OAuth, Auth0 como AS, login Google)
  - URL pública: `https://api.bfincont.com.br/mcp`
  - Passo-a-passo de adição em claude.ai/settings/connectors (com prints se possível)
  - Passo-a-passo em ChatGPT Apps (análogo)
  - Variáveis de ambiente
  - Como provisionar usuários:
    - Automaticamente via `MCP_PROVISIONING_ALLOWED_EMAILS`
    - Manualmente via SQL (exemplo de `INSERT INTO usuarios`)
  - Troubleshooting: 401 (token ausente/inválido), 403 (user not found), session expirada
- [x] 10.2 Atualizar `README.md` com linha destacando: "BFin expõe um Remote MCP em `https://api.bfincont.com.br/mcp` — pluggável em Claude/ChatGPT via OAuth"
- [x] 10.3 Adicionar seção no `README.md` em "Deploy" referenciando o plugin MCP HTTP e suas env vars

## 11. Limpeza e PR

- [x] 11.1 Rodar `npm run lint && npm run typecheck && npm run test:vitest` localmente:
  - Lint: 0 errors, 5 warnings (todos pré-existentes em routes/services não relacionados)
  - Typecheck: passou sem erros
  - Testes: 34/35 test files passaram, 212/213 tests passaram. A única falha é em `tests/debts.test.ts` (cálculo de data de vencimento em ano bissexto) — bug pré-existente, não introduzido por esta change. Unhandled error em `security.test.ts` também é pré-existente.
- [ ] 11.2 Abrir PR pra `master` com título `feat(mcp): replace STDIO transport with HTTP+SSE OAuth for Claude Connectors`
- [ ] 11.3 Aguardar CI verde (pipeline de `openspec/changes/add-ci-pipeline-quality-gates` já existente) e aprovar
- [ ] 11.4 Após merge, arquivar este change movendo pra `openspec/changes/archive/<data>-add-mcp-http-oauth-transport/` (convenção existente)

## Referências técnicas

- MCP Auth Spec (2025-06-18): https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- RFC 9728 (OAuth 2.0 Protected Resource Metadata): https://datatracker.ietf.org/doc/html/rfc9728
- RFC 7591 (OAuth Dynamic Client Registration): https://datatracker.ietf.org/doc/html/rfc7591
- `@modelcontextprotocol/sdk` StreamableHTTPServerTransport: https://github.com/modelcontextprotocol/typescript-sdk
- Auth0 DCR: https://auth0.com/docs/get-started/applications/dynamic-client-registration
- Auth0 Social Connections: https://auth0.com/docs/authenticate/identity-providers/social-identity-providers

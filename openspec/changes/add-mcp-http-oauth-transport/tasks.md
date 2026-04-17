## 1. Configuração Auth0

- [ ] 1.1 Criar tenant Auth0 em região US; anotar domain (ex: `bfin.us.auth0.com`)
- [ ] 1.2 Configurar Branding (nome app `Bfin`, email de suporte, email dev, domínio autorizado `bfincont.com.br`)
- [ ] 1.3 Em **Authentication → Social**, adicionar **Google** desligando "Auth0 Dev Keys" e colando o Client ID/Secret do OAuth Client já criado em `accounts.google.com`
- [ ] 1.4 Criar API no Auth0:
  - Name: `Bfin MCP`
  - Identifier (audience): `https://mcp.bfincont.com.br` (valor exato — não precisa ser URL real, é só identificador; use este valor no `MCP_AUDIENCE_HTTP`)
  - Signing Algorithm: **RS256**
- [ ] 1.5 Na aba **Permissions** da API `Bfin MCP`, adicionar todos os escopos listados em `docs/mcp.md` ("Escopos suportados"): `accounts:read`, `accounts:write`, `account-members:read`, `categories:read`, `categories:write`, `transactions:read`, `transactions:write`, `debts:read`, `debts:write`, `goals:read`, `goals:write`, `daily-limit:read`, `daily-limit:write`, `projections:read`
- [ ] 1.6 Habilitar **Dynamic Application Registration** em **Tenant Settings → Advanced** (`flags.enable_dynamic_application_registration = true`)
- [ ] 1.7 Em **Tenant Settings → Advanced → Default Audience**, definir `https://mcp.bfincont.com.br` (opcional, facilita clients que não passam audience explicitamente)
- [ ] 1.8 Criar uma aplicação **Machine to Machine** de teste (`bfin-mcp-test`) com a API `Bfin MCP` autorizada e todos os escopos marcados — será usada para obter um token de teste via `curl /oauth/token` durante desenvolvimento

## 2. Decisão arquitetural: processo separado vs Fastify embutido

- [ ] 2.1 Escrever ADR curto (`openspec/changes/add-mcp-http-oauth-transport/decision.md`) comparando as duas opções:
  - **A** - Montar rotas MCP sob o Fastify existente (`src/server.ts`) em `/mcp/*` — reutiliza infraestrutura, SSL, logging, rate limit; acoplamento com API HTTP
  - **B** - Processo separado (`src/mcp/http-server.ts`) em porta própria — isolamento maior, deploy/escala independentes, mas dobra infra
- [ ] 2.2 Registrar decisão na proposta (escolher A por default — reutiliza Traefik existente em `/v2/mcp/*`, menor superfície de deploy)

## 3. Fundação de código

- [ ] 3.1 Criar `src/mcp/oauth/bearer-auth.ts`:
  - Função `extractBearerToken(req): string | null` que lê `Authorization: Bearer <token>`
  - Função `buildWwwAuthenticate(resourceUrl): string` que monta header `Bearer resource_metadata="<resourceUrl>/.well-known/oauth-protected-resource"` para respostas 401
- [ ] 3.2 Criar `src/mcp/oauth/metadata.ts`:
  - Handler que retorna JSON conforme RFC 9728 com campos: `resource`, `authorization_servers`, `bearer_methods_supported`, `scopes_supported`, `resource_documentation`
  - Valores vindos da config (`MCP_HTTP_BASE_URL`, `MCP_AUTH_SERVER_URL`, escopos estáticos da lista conhecida)
- [ ] 3.3 Criar `src/lib/oidc-mcp-http.ts` (ou estender `src/lib/oidc-jwks.ts`):
  - Validator JWT que aceita config `{ issuerUrl, audience }` para MCP HTTP (audience distinta da API HTTP e da STDIO)
  - Retorna `{ sub, email?, name?, scopes: Set<string> }`
- [ ] 3.4 Criar `src/mcp/oauth/provisioning.ts`:
  - Função `resolveUserFromClaims(claims, { provisioningAllowedEmails })` que:
    - Busca `usuarios.id_provedor = claims.sub`; se existir, retorna `usuarios.id`
    - Se não existir e email estiver na allowlist: cria `usuarios (id_provedor, email, nome)` e retorna id
    - Se não existir e allowlist estiver vazia ou email fora dela: lança `ServiceAccountBootstrapError("USER_NOT_FOUND")`
- [ ] 3.5 Refatorar `src/mcp/identity.ts`:
  - Extrair função pura `buildServiceAccount({ payload, actingUserId }): ServiceAccount` dos 30 últimos do `loadServiceAccount`
  - Renomear `loadServiceAccount` → `loadServiceAccountFromEnv` (comportamento atual, usado pelo STDIO)
  - Adicionar `loadServiceAccountFromToken({ token, validator, provisioning }): ServiceAccount` que usa `validator` + `resolveUserFromClaims` e monta o `ServiceAccount` por request
  - **STDIO preservado**: `src/mcp/server.ts` segue chamando `loadServiceAccountFromEnv` igual
- [ ] 3.6 Adicionar schema `httpMcpConfigSchema` em `src/config.ts` com: `MCP_HTTP_ENABLED` (bool, default false), `MCP_HTTP_BASE_URL` (url), `MCP_AUDIENCE_HTTP` (url), `MCP_AUTH_SERVER_URL` (url), `MCP_PROVISIONING_ALLOWED_EMAILS` (string opcional, vírgula-separado ou regex)

## 4. Transporte HTTP no Fastify

- [ ] 4.1 Criar plugin `src/plugins/mcp-http.ts` encapsulado via `fastify-plugin`:
  - Registra apenas se `config.httpMcp.enabled === true`
  - Expõe rotas: `GET /mcp/.well-known/oauth-protected-resource`, `POST /mcp`, `GET /mcp/sse`, `DELETE /mcp/sse/:sessionId`
- [ ] 4.2 Em `POST /mcp` e `GET /mcp/sse`:
  - Extrair Bearer token; se ausente → 401 com `WWW-Authenticate`
  - Validar JWT via validator MCP HTTP; se inválido → 401 com `WWW-Authenticate`
  - Resolver `ServiceAccount` por token (`loadServiceAccountFromToken`)
  - Criar/recuperar `StreamableHTTPServerTransport` por session id (header `Mcp-Session-Id`)
  - Montar `McpServer` com `buildToolRegistry(sa)` e `buildMcpServer({ sa, registry })` — **reuso direto do código existente**, sem duplicar lógica de tools
- [ ] 4.3 Implementar gerenciador de sessões in-memory (`Map<sessionId, { transport, sa, lastActivity }>`) com TTL de 10 min de inatividade e cleanup em intervalo
- [ ] 4.4 Registrar o plugin em `src/server.ts` (API Fastify principal) após os plugins existentes
- [ ] 4.5 Adicionar scripts ao `package.json`:
  - `"mcp:http:dev": "MCP_HTTP_ENABLED=true tsx src/server.ts"` (modo dev reusando servidor Fastify)
  - Sem script `mcp:http:start` separado — subir pela API HTTP normal com flag

## 5. Testes

- [ ] 5.1 Unit: `tests/mcp/oauth/bearer-auth.test.ts` — cobertura de header ausente, header malformado, token válido extraído
- [ ] 5.2 Unit: `tests/mcp/oauth/metadata.test.ts` — formato RFC 9728 correto com todos os campos obrigatórios
- [ ] 5.3 Unit: `tests/mcp/oauth/provisioning.test.ts` — 3 casos: usuário existente; não existente + email permitido (cria); não existente + email fora da allowlist (erro)
- [ ] 5.4 Unit: `tests/mcp/identity.test.ts` (existente) — atualizar para cobrir `loadServiceAccountFromToken` e garantir que `loadServiceAccountFromEnv` mantém comportamento idêntico ao anterior
- [ ] 5.5 Integração: `tests/mcp/http-transport.int.test.ts` — sobe o Fastify com `MCP_HTTP_ENABLED=true`, chama `/mcp/.well-known/oauth-protected-resource`, chama `POST /mcp` sem token (espera 401), com token válido (espera 200 + session id no header), com token expirado (espera 401)
- [ ] 5.6 E2E manual: script `scripts/test-mcp-http.sh` que:
  - Pega token via `curl -X POST https://<auth0>/oauth/token` com client_credentials
  - Faz request MCP `initialize` via `POST /mcp` com o token
  - Faz request `tools/list` via `GET /mcp/sse` com o mesmo session id
  - Valida que `mcp.whoami` retorna o `sub` esperado

## 6. Deploy na VPS

- [ ] 6.1 Atualizar `.env` em produção (`/home/deploy/bfin-new/.env`) com as novas variáveis `MCP_HTTP_*`
- [ ] 6.2 Rebuild da imagem: `docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build`
- [ ] 6.3 Validar endpoint metadata: `curl -s https://api.bfincont.com.br/v2/mcp/.well-known/oauth-protected-resource | jq`
- [ ] 6.4 Validar 401 sem token: `curl -i -X POST https://api.bfincont.com.br/v2/mcp` — conferir header `WWW-Authenticate`
- [ ] 6.5 Validar logs do Fastify: `docker logs bfin-new-api-1 --tail 50` — não deve haver erro na subida do plugin MCP HTTP

## 7. Integração com clientes MCP

- [ ] 7.1 **MCP Inspector (debug)**: `npx @modelcontextprotocol/inspector`, adicionar connector URL `https://api.bfincont.com.br/v2/mcp`, copiar token do step 5.6 e validar `tools/list`
- [ ] 7.2 **Claude.ai Connectors**:
  - Ir em claude.ai → Settings → Connectors → **Add custom connector**
  - URL: `https://api.bfincont.com.br/v2/mcp`
  - Claude detecta o metadata e inicia OAuth flow → login via Auth0 (botão Google) → consent screen com escopos → redireciona de volta
  - Validar que tools aparecem na lista
  - Testar `transactions.list` em uma conversa
- [ ] 7.3 **ChatGPT Apps/Custom GPT**: repetir fluxo equivalente se o projeto já tiver Custom GPT configurado; do contrário, apenas documentar como fazer em `docs/mcp-http.md`
- [ ] 7.4 Validar revogação: revogar grant do Claude no dashboard Auth0 → próxima request do Claude deve dar 401 → Claude redireciona para reauth

## 8. Documentação

- [ ] 8.1 Criar `docs/mcp-http.md` com:
  - Quando usar HTTP vs STDIO
  - URL pública do Connector: `https://api.bfincont.com.br/v2/mcp`
  - Passo-a-passo de adição no claude.ai/settings/connectors
  - Variáveis de ambiente necessárias
  - Como provisionar usuários manualmente (SQL) se allowlist for vazia
  - Troubleshooting: 401, 403, session expirada
- [ ] 8.2 Atualizar `docs/mcp.md` com nota no topo: "Para Remote MCP (Claude Connectors, ChatGPT Apps), ver docs/mcp-http.md. Este documento cobre o modo STDIO local"
- [ ] 8.3 Atualizar `README.md` com linha mencionando o Remote MCP e link para `docs/mcp-http.md`

## 9. Limpeza e PR

- [ ] 9.1 Rodar lint, typecheck, testes localmente (`npm run lint && npm run typecheck && npm test`)
- [ ] 9.2 Abrir PR para `master` com título `feat(mcp): HTTP+SSE transport with OAuth 2.1 for Claude Connectors`
- [ ] 9.3 Marcar como ready após CI verde e aprovar
- [ ] 9.4 Após merge, arquivar o change movendo para `openspec/changes/archive/<data>-add-mcp-http-oauth-transport/` (convenção existente)

## Referências técnicas

- MCP Auth Spec (2025-06-18): https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- RFC 9728 (OAuth 2.0 Protected Resource Metadata): https://datatracker.ietf.org/doc/html/rfc9728
- RFC 7591 (Dynamic Client Registration): https://datatracker.ietf.org/doc/html/rfc7591
- `@modelcontextprotocol/sdk` StreamableHTTPServerTransport: https://github.com/modelcontextprotocol/typescript-sdk
- Auth0 DCR: https://auth0.com/docs/get-started/applications/dynamic-client-registration

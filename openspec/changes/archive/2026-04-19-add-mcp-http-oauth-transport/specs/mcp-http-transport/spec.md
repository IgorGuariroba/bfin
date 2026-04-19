## ADDED Requirements

### Requirement: Plugin Fastify monta transporte MCP em HTTP+SSE
O sistema SHALL expor um plugin Fastify em `src/plugins/mcp-http.ts` que registra o `StreamableHTTPServerTransport` do `@modelcontextprotocol/sdk` sob o prefixo `/mcp` da API HTTP principal, reutilizando integralmente a tool registry existente (`src/mcp/tools/*`), o `buildMcpServer` (`src/mcp/rpc.ts`) e a camada de authz (`src/mcp/authz.ts`). O plugin SHALL ser registrado via `fastify-plugin` após `auth-guard` e `account-authorization` em `src/server.ts`.

#### Scenario: Plugin carrega em bootstrap
- **WHEN** a aplicação Fastify inicia com `MCP_HTTP_ENABLED=true`
- **THEN** o plugin registra as rotas `POST /mcp`, `GET /mcp/sse`, `DELETE /mcp/sse/:sessionId` e `GET /mcp/.well-known/oauth-protected-resource` sem erro no log

#### Scenario: Plugin desabilitado por gate
- **WHEN** a aplicação inicia com `MCP_HTTP_ENABLED=false`
- **THEN** nenhuma rota `/mcp/*` é registrada; requests a esses paths retornam `404` do Fastify

### Requirement: Endpoint POST /mcp aceita mensagens JSON-RPC
O endpoint `POST /mcp` SHALL receber mensagens JSON-RPC 2.0 do cliente MCP, delegar ao `StreamableHTTPServerTransport` e responder com o resultado ou evento SSE. O endpoint SHALL aceitar apenas `Content-Type: application/json` e rejeitar outros com `415 Unsupported Media Type`.

#### Scenario: Cliente envia initialize
- **WHEN** o cliente envia `POST /mcp` com body `{"jsonrpc":"2.0","id":1,"method":"initialize",...}` e Bearer válido
- **THEN** o servidor responde com JSON-RPC result contendo `serverInfo` e `capabilities.tools = {}`, mesmo comportamento do transporte STDIO anterior

#### Scenario: Content-Type inválido
- **WHEN** o cliente envia `POST /mcp` com `Content-Type: text/plain`
- **THEN** o servidor retorna `415 Unsupported Media Type` sem invocar o transporte

### Requirement: Endpoint GET /mcp/sse mantém fluxo server-sent events
O endpoint `GET /mcp/sse` SHALL abrir um stream SSE (`Content-Type: text/event-stream`) associado a uma sessão identificada pelo header `Mcp-Session-Id`. O servidor SHALL enviar eventos JSON-RPC pushed pelo transporte até o cliente fechar a conexão ou a sessão expirar.

#### Scenario: Abertura de sessão SSE
- **WHEN** o cliente envia `GET /mcp/sse` com Bearer válido e `Mcp-Session-Id` previamente recebido em POST /mcp
- **THEN** o servidor responde com `200` + `Content-Type: text/event-stream` e mantém a conexão aberta até ser fechada

#### Scenario: Session id desconhecido
- **WHEN** o cliente envia `GET /mcp/sse` com `Mcp-Session-Id` que não existe no store
- **THEN** o servidor responde `404 Not Found` com payload JSON indicando sessão inválida

### Requirement: Endpoint DELETE /mcp/sse/:sessionId encerra sessão
O endpoint `DELETE /mcp/sse/:sessionId` SHALL permitir que o cliente encerre explicitamente uma sessão, removendo-a do store e fechando o stream SSE associado. A operação SHALL ser idempotente.

#### Scenario: Encerramento de sessão existente
- **WHEN** o cliente envia `DELETE /mcp/sse/abc-123` com Bearer válido e a sessão existe
- **THEN** o servidor remove a sessão do store, fecha o stream e responde `204 No Content`

#### Scenario: Encerramento de sessão inexistente
- **WHEN** o cliente envia `DELETE /mcp/sse/nao-existe` com Bearer válido
- **THEN** o servidor responde `204 No Content` (idempotente, sem vazar existência de outras sessões)

### Requirement: CORS restrito ao prefixo /mcp
O sistema SHALL registrar `@fastify/cors` limitado ao prefixo `/mcp/*` com allowlist `["https://claude.ai", "https://app.claude.com", "http://localhost:*"]`. O preflight `OPTIONS` SHALL responder com `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS` e `Access-Control-Allow-Headers: Authorization, Content-Type, Mcp-Session-Id`.

#### Scenario: Preflight de claude.ai
- **WHEN** o browser envia `OPTIONS /mcp` com `Origin: https://claude.ai` e `Access-Control-Request-Method: POST`
- **THEN** o servidor responde `204` com `Access-Control-Allow-Origin: https://claude.ai` e métodos permitidos

#### Scenario: Origem não autorizada
- **WHEN** o browser envia `OPTIONS /mcp` com `Origin: https://attacker.example`
- **THEN** o servidor responde sem `Access-Control-Allow-Origin` — o browser bloqueia a request

### Requirement: Rate limit por bucket diferenciado
O sistema SHALL aplicar `@fastify/rate-limit` com três buckets distintos nas rotas MCP: metadata (público, permissivo), POST /mcp (moderado, chave = `sub` do token), GET /mcp/sse (conservador, chave = `sub` do token). A chave padrão SHALL ser o IP apenas quando o token ainda não foi validado.

#### Scenario: Bucket de metadata é permissivo
- **WHEN** o mesmo cliente faz 100 requests em 1 minuto a `GET /mcp/.well-known/oauth-protected-resource`
- **THEN** nenhum request é rejeitado por rate limit (metadata é descoberta legítima)

#### Scenario: Bucket de tools/call estoura por usuário
- **WHEN** um único `sub` ultrapassa o limite configurado de POST /mcp no intervalo
- **THEN** o servidor responde `429 Too Many Requests` com `Retry-After` no header

### Requirement: Scripts mcp:dev e mcp:start removidos
O `package.json` SHALL **não** expor mais os scripts `mcp:dev` nem `mcp:start`. O MCP passa a rodar como parte do processo Fastify principal (`npm run dev`/`npm run start`).

#### Scenario: Tentativa de rodar mcp:dev
- **WHEN** o operador executa `npm run mcp:dev`
- **THEN** o npm retorna erro `missing script: mcp:dev` — o script foi removido junto com o entrypoint STDIO

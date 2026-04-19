## ADDED Requirements

### Requirement: Metadata RFC 9728 em /.well-known/oauth-protected-resource
O servidor MCP SHALL expor `GET /mcp/.well-known/oauth-protected-resource` retornando JSON compatível com RFC 9728, contendo pelo menos os campos: `resource` (valor de `MCP_HTTP_BASE_URL`), `authorization_servers` (array com `MCP_AUTH_SERVER_URL`), `bearer_methods_supported: ["header"]`, `scopes_supported` (lista completa de escopos MCP). A rota SHALL ser pública (sem Bearer) e cacheável (`Cache-Control: public, max-age=300`).

#### Scenario: Descoberta por cliente Claude
- **WHEN** o cliente faz `GET /mcp/.well-known/oauth-protected-resource` sem Authorization
- **THEN** o servidor responde `200` com JSON válido contendo todos os campos obrigatórios da RFC 9728

#### Scenario: Conteúdo reflete configuração
- **WHEN** a config roda com `MCP_HTTP_BASE_URL=https://api.bfincont.com.br/mcp` e `MCP_AUTH_SERVER_URL=https://bfin.us.auth0.com`
- **THEN** o JSON retornado contém `"resource": "https://api.bfincont.com.br/mcp"` e `"authorization_servers": ["https://bfin.us.auth0.com"]`

### Requirement: Bearer-only authentication em rotas MCP
O sistema SHALL aceitar tokens OAuth apenas via header `Authorization: Bearer <jwt>`. Tokens em query string (`?access_token=...`) ou cookies SHALL ser ignorados. Requests a `POST /mcp` e `GET /mcp/sse` sem Bearer válido SHALL retornar `401 Unauthorized`.

#### Scenario: Token no query string é rejeitado
- **WHEN** o cliente envia `POST /mcp?access_token=<jwt>` sem Authorization header
- **THEN** o servidor retorna `401 Unauthorized` — a query string nunca é consultada

#### Scenario: Header vazio
- **WHEN** o cliente envia `POST /mcp` sem `Authorization`
- **THEN** o servidor retorna `401 Unauthorized`

#### Scenario: Bearer malformado
- **WHEN** o cliente envia `Authorization: Basic xyz` ou `Authorization: Bearer` (sem token)
- **THEN** o servidor retorna `401 Unauthorized`

### Requirement: WWW-Authenticate aponta para metadata em 401
Todo `401 Unauthorized` retornado pelas rotas MCP SHALL incluir o header `WWW-Authenticate` no formato `Bearer resource_metadata="<MCP_HTTP_BASE_URL>/.well-known/oauth-protected-resource"`. Isso permite que clientes MCP compliant com o spec `2025-06-18` descubram o Authorization Server automaticamente.

#### Scenario: 401 por token ausente
- **WHEN** request sem Bearer chega em `POST /mcp`
- **THEN** a resposta inclui `WWW-Authenticate: Bearer resource_metadata="https://api.bfincont.com.br/mcp/.well-known/oauth-protected-resource"`

#### Scenario: 401 por token inválido
- **WHEN** request com Bearer de assinatura inválida chega em `POST /mcp`
- **THEN** a resposta inclui o mesmo header `WWW-Authenticate` com `error="invalid_token"`

### Requirement: Validação JWT contra JWKS do Auth0
O sistema SHALL validar cada Bearer JWT contra o JWKS do Authorization Server configurado em `MCP_AUTH_SERVER_URL`, verificando: assinatura, `iss` (igual ao issuer do AS), `aud` (igual a `MCP_AUDIENCE_HTTP`), `exp` (não expirado). O JWKS SHALL ser cacheado em memória com TTL de 10 minutos.

#### Scenario: Token válido do Auth0
- **WHEN** Bearer com `iss`, `aud`, `exp` corretos e assinatura válida contra JWKS chega
- **THEN** o sistema decodifica claims, anexa à request e prossegue para o handler

#### Scenario: Audience incorreta
- **WHEN** Bearer com `aud` diferente de `MCP_AUDIENCE_HTTP` chega
- **THEN** o sistema retorna `401` com `error="invalid_token"` no `WWW-Authenticate`

#### Scenario: Assinatura inválida
- **WHEN** Bearer com assinatura que não bate com nenhuma chave do JWKS
- **THEN** o sistema retorna `401` com `error="invalid_token"`

#### Scenario: JWKS cacheado
- **WHEN** 100 requests chegam em 1 minuto com tokens válidos
- **THEN** o JWKS é baixado no máximo uma vez nesse intervalo (cache de 10min)

### Requirement: Scopes OAuth mapeiam para ReadonlySet interno
A claim `scope` (string separada por espaço) do JWT validado SHALL ser parseada para um `ReadonlySet<string>` e propagada ao `McpContext` exatamente como a implementação STDIO atual esperava. Escopos desconhecidos do MCP SHALL ser ignorados com log `info`, sem rejeitar o token.

#### Scenario: Token com múltiplos scopes
- **WHEN** JWT contém `scope: "accounts:read transactions:write debts:read"`
- **THEN** `McpContext.scopes` recebe `Set { "accounts:read", "transactions:write", "debts:read" }`

#### Scenario: Scope desconhecido é ignorado
- **WHEN** JWT contém `scope: "accounts:read unknown:scope"`
- **THEN** `McpContext.scopes` recebe apenas `{ "accounts:read" }` e um log `info` registra o scope ignorado

#### Scenario: Token sem scope
- **WHEN** JWT não contém claim `scope`
- **THEN** `McpContext.scopes` recebe `Set` vazio; `tools/list` retorna `[]`

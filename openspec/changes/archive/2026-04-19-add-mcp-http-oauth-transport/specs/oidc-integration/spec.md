## ADDED Requirements

### Requirement: Helper de validação Bearer para audience MCP
O plugin `src/plugins/oidc.ts` (ou módulo equivalente em `src/lib/oidc-mcp.ts`) SHALL expor um helper `validateBearerForMcp(token): Promise<ValidatedClaims>` que valida tokens JWT contra o mesmo fluxo OIDC existente, mas com audience igual a `MCP_AUDIENCE_HTTP` e issuer igual a `MCP_AUTH_SERVER_URL`. O helper SHALL reutilizar o cache de JWKS do módulo OIDC existente quando o issuer do MCP for o mesmo; caso contrário, SHALL manter um cache separado com TTL de 10 minutos.

#### Scenario: Helper valida token MCP
- **WHEN** o plugin MCP HTTP chama `validateBearerForMcp(token)` com um Bearer válido emitido por `MCP_AUTH_SERVER_URL`
- **THEN** o helper retorna as claims decodificadas (`sub`, `scope`, `email`, `name`)

#### Scenario: Helper rejeita token da API HTTP
- **WHEN** o helper é chamado com um token cuja `aud = OIDC_AUDIENCE`
- **THEN** o helper lança erro `INVALID_AUDIENCE`, sem consultar o JWKS principal

#### Scenario: JWKS cacheado por issuer
- **WHEN** o helper recebe 100 tokens válidos do mesmo issuer em 1 minuto
- **THEN** o JWKS é baixado no máximo uma vez (cache de 10min)

### Requirement: Configuração de audiência e issuer MCP independentes
A configuração do sistema SHALL aceitar `MCP_AUTH_SERVER_URL` (issuer do AS Auth0) e `MCP_AUDIENCE_HTTP` (audience esperada nos tokens MCP) como variáveis separadas de `OIDC_ISSUER_URL` e `OIDC_AUDIENCE`. As duas famílias de variáveis podem apontar para o mesmo issuer (Auth0) com audiences distintas, sem que o código da API HTTP seja afetado.

#### Scenario: Mesmo tenant Auth0, audiences distintas
- **WHEN** `OIDC_ISSUER_URL = MCP_AUTH_SERVER_URL = "https://bfin.us.auth0.com"` e `OIDC_AUDIENCE = "https://api.bfincont.com.br"`, `MCP_AUDIENCE_HTTP = "https://mcp.bfincont.com.br"`
- **THEN** ambos fluxos funcionam com o mesmo JWKS cacheado, mas tokens não cruzam fronteiras de audience

#### Scenario: Issuers distintos
- **WHEN** `OIDC_ISSUER_URL` e `MCP_AUTH_SERVER_URL` apontam para tenants diferentes
- **THEN** cada um mantém cache de JWKS independente e nunca mistura chaves

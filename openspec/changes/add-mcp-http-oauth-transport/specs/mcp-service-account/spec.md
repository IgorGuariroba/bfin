## MODIFIED Requirements

### Requirement: Validação do token Bearer por request
O sistema SHALL validar o Bearer JWT recebido no header `Authorization` de cada request MCP contra o JWKS do Authorization Server configurado em `MCP_AUTH_SERVER_URL`. A audiência SHALL ser igual a `MCP_AUDIENCE_HTTP` (distinta de `OIDC_AUDIENCE` da API HTTP). A validação SHALL cobrir assinatura, expiração (`exp`) e issuer (`iss`). A validação acontece em cada request, não mais no bootstrap.

#### Scenario: Token válido aceito
- **WHEN** request chega com Bearer emitido por `MCP_AUTH_SERVER_URL`, `aud = MCP_AUDIENCE_HTTP`, não expirado
- **THEN** o handler prossegue; o JWT decodificado fica anexado à request

#### Scenario: Token expirado
- **WHEN** request chega com Bearer cuja `exp` já passou
- **THEN** o servidor retorna `401 Unauthorized` com `WWW-Authenticate: Bearer error="invalid_token"`

#### Scenario: Audiência incorreta
- **WHEN** request chega com Bearer cuja `aud` difere de `MCP_AUDIENCE_HTTP` (ex.: token da API HTTP)
- **THEN** o servidor retorna `401 Unauthorized`

#### Scenario: Variáveis obrigatórias ausentes no bootstrap
- **WHEN** `MCP_AUTH_SERVER_URL`, `MCP_AUDIENCE_HTTP` ou `MCP_HTTP_BASE_URL` não estão definidas
- **THEN** o processo Fastify falha no bootstrap identificando cada variável ausente

### Requirement: Resolução do usuário a partir do sub do token
O sistema SHALL ler a claim `sub` do JWT validado e buscar em `usuarios WHERE id_provedor = sub` o registro correspondente, atribuindo `actingUserId` à request. Se o registro não existe, SHALL aplicar o fluxo de provisionamento automático baseado em `MCP_PROVISIONING_ALLOWED_EMAILS` (ver capability `mcp-per-request-identity`).

#### Scenario: sub mapeado para usuário existente
- **WHEN** request com Bearer cujo `sub` corresponde a `usuarios.id_provedor`
- **THEN** o `actingUserId` é carregado em memória como "acting user" apenas da request atual

#### Scenario: sub sem registro e sem allowlist
- **WHEN** `sub` não existe e `MCP_PROVISIONING_ALLOWED_EMAILS` é vazia
- **THEN** o servidor retorna `403 Forbidden` com código `USER_NOT_PROVISIONED`

### Requirement: Extração de escopos do token
O sistema SHALL extrair os escopos da claim `scope` do token (string separada por espaço, padrão OAuth 2.0) para um `ReadonlySet<string>` associado à request. Escopos SHALL usar o formato `<resource>:<action>`. O conjunto é **por-request**, não mais por-processo.

#### Scenario: Claim scope presente
- **WHEN** o token contém `scope: "accounts:read transactions:read transactions:write"`
- **THEN** a request tem `scopes = Set { "accounts:read", "transactions:read", "transactions:write" }`

#### Scenario: Claim scope ausente
- **WHEN** o token não contém `scope`
- **THEN** a request tem `scopes = Set()`; `tools/list` retorna `[]` e qualquer `tools/call` é rejeitado por falta de escopo

#### Scenario: Escopo com formato inválido
- **WHEN** `scope` contém item sem `:` (ex.: `"admin"`)
- **THEN** o sistema ignora o item, registra log `info` e usa apenas os itens bem-formados

### Requirement: Enforcement de escopo por tool
O registry de tools SHALL consultar os escopos da request para decidir visibilidade em `tools/list` e autorização em `tools/call`. Tools cujo `requiredScope` não está no conjunto da request SHALL ser ocultadas/rejeitadas.

#### Scenario: tools/list filtrado pelos scopes da request
- **WHEN** o cliente chama `tools/list` com token concedendo apenas `accounts:read`
- **THEN** a resposta inclui apenas tools cujo `requiredScope = "accounts:read"`

#### Scenario: tools/call sem escopo
- **WHEN** o cliente chama `tools/call` para `transactions.create` mas o token da request não concede `transactions:write`
- **THEN** o servidor retorna erro JSON-RPC com mensagem de escopo insuficiente e não invoca o service

### Requirement: Autorização por conta continua obrigatória
Para tools cujo input contém `contaId`, o sistema SHALL verificar que o `actingUserId` da request tem associação em `conta_usuarios` com papel suficiente, reusando a lógica compartilhada do domínio. A checagem SHALL ocorrer após o scope check e antes da execução do service.

#### Scenario: Usuário é owner da conta
- **WHEN** `transactions.create` com `contaId` onde `actingUserId` tem papel `owner`
- **THEN** a invocação prossegue e a transação é criada atribuindo o acting user como criador

#### Scenario: Usuário é viewer tentando escrever
- **WHEN** `transactions.create` com `contaId` onde `actingUserId` tem papel `viewer`
- **THEN** o servidor retorna `ForbiddenError` mapeado para código JSON-RPC `-32003`

#### Scenario: Usuário sem associação à conta
- **WHEN** a tool é chamada com `contaId` onde o acting user não tem registro em `conta_usuarios`
- **THEN** o servidor retorna erro forbidden

### Requirement: requestedBy como contexto somente de auditoria
O sistema SHALL aceitar o campo opcional `meta.requestedBy: string` em qualquer `tools/call`, com validação (≤200 chars, sem bytes de controle). Se válido, SHALL anexar como `requested_by` ao audit log. NUNCA SHALL usar para alterar identidade, acting user ou escopos.

#### Scenario: requestedBy anexado ao log
- **WHEN** cliente chama tool com `meta.requestedBy: "agent-a"`
- **THEN** o log inclui `requested_by: "agent-a"` mas a decisão de autorização usa apenas os escopos do token

#### Scenario: requestedBy não eleva privilégio
- **WHEN** cliente chama tool sem o scope necessário e envia `meta.requestedBy: "admin-user-id"`
- **THEN** o servidor retorna erro de escopo insuficiente

#### Scenario: requestedBy inválido descartado
- **WHEN** cliente envia `meta.requestedBy` com >200 caracteres ou bytes de controle
- **THEN** log é emitido sem `requested_by` e um log `warn` separado registra o descarte

#### Scenario: requestedBy ausente
- **WHEN** cliente não envia `meta.requestedBy`
- **THEN** a invocação prossegue normalmente e o log não contém o campo

### Requirement: Separação de audiência entre API HTTP e MCP
O sistema SHALL exigir que tokens usados no MCP tenham `aud = MCP_AUDIENCE_HTTP`, distinta de `OIDC_AUDIENCE` da API HTTP. Tokens emitidos para uma audience SHALL ser rejeitados pela outra.

#### Scenario: Token de API HTTP recusado pelo MCP
- **WHEN** cliente envia Bearer cuja `aud` corresponde a `OIDC_AUDIENCE` em `POST /mcp`
- **THEN** o servidor retorna `401 Unauthorized`

#### Scenario: Token MCP recusado na API HTTP
- **WHEN** cliente envia Bearer cuja `aud = MCP_AUDIENCE_HTTP` em qualquer rota autenticada da API HTTP (ex.: `/v2/transacoes`)
- **THEN** o `auth-guard` HTTP rejeita com 401

## REMOVED Requirements

### Requirement: Bootstrap valida token da service account
**Reason**: Identidade do MCP deixou de ser uma service account única carregada em env no bootstrap. Cada request agora traz seu próprio token OAuth validado por request. As env vars `MCP_SERVICE_ACCOUNT_TOKEN` e `MCP_OIDC_AUDIENCE` deixaram de existir (a segunda foi renomeada para `MCP_AUDIENCE_HTTP` e tem semântica diferente — é a audience esperada, não um valor lido de um token estático).

**Migration**: Remover `MCP_SERVICE_ACCOUNT_TOKEN`, `MCP_OIDC_AUDIENCE`, `MCP_SUBJECT_USER_ID` do `.env`. Adicionar `MCP_AUTH_SERVER_URL`, `MCP_AUDIENCE_HTTP`, `MCP_HTTP_BASE_URL` conforme documentado em `docs/mcp.md`. O fluxo novo usa Auth0 como AS, DCR para registro de clientes, e tokens por usuário emitidos via OAuth Authorization Code.

### Requirement: Resolução do usuário alvo da service account
**Reason**: `MCP_SUBJECT_USER_ID` era o mecanismo de identificar um usuário fixo em env. Com identidade por request, o `actingUserId` é derivado do `sub` do JWT da request; não existe mais um "target user" global.

**Migration**: Remover `MCP_SUBJECT_USER_ID` do `.env`. Configurar `MCP_PROVISIONING_ALLOWED_EMAILS` para controlar quem pode ser criado automaticamente no primeiro acesso via OAuth.

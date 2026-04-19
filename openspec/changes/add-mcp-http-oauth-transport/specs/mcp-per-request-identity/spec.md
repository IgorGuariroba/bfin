## ADDED Requirements

### Requirement: Identidade resolvida por request via claim sub
O sistema SHALL resolver a identidade (`actingUserId`, `ServiceAccount`) de cada request MCP a partir da claim `sub` do JWT validado, em vez de usar `MCP_SUBJECT_USER_ID` de env. O mapeamento SHALL usar a coluna `usuarios.id_provedor` (mesma convenção da API HTTP).

#### Scenario: sub mapeado para usuário existente
- **WHEN** Bearer válido chega com `sub: "auth0|abc123"` e existe `usuarios WHERE id_provedor = 'auth0|abc123'`
- **THEN** o `ServiceAccount` é construído com `actingUserId = <id desse usuário>` e scopes do token

#### Scenario: sub sem mapeamento e provisionamento desabilitado
- **WHEN** Bearer válido chega com `sub` sem registro em `usuarios` e `MCP_PROVISIONING_ALLOWED_EMAILS` está vazio
- **THEN** o servidor retorna `403 Forbidden` com código `USER_NOT_PROVISIONED` e mensagem amigável em PT-BR

### Requirement: Provisionamento automático controlado por allowlist
Quando `sub` não existe e `MCP_PROVISIONING_ALLOWED_EMAILS` está configurada, o sistema SHALL verificar se o `email` das claims bate com a allowlist (CSV ou regex). Se sim, SHALL criar um registro novo em `usuarios` com `id_provedor = sub`, `email = claim.email`, `nome = claim.name`. Se não bate, SHALL retornar `403 Forbidden`.

#### Scenario: Email na allowlist
- **WHEN** Bearer chega com `sub` novo e `email: "igor@bfincont.com.br"`, e `MCP_PROVISIONING_ALLOWED_EMAILS="igor@bfincont.com.br,dev@bfincont.com.br"`
- **THEN** o sistema cria `usuarios` com as claims e prossegue como se o `sub` já existisse

#### Scenario: Email fora da allowlist
- **WHEN** Bearer chega com `sub` novo e `email: "random@gmail.com"`, allowlist não contém esse email
- **THEN** o servidor retorna `403 Forbidden` com código `EMAIL_NOT_ALLOWED`, sem criar registro

#### Scenario: Allowlist em regex
- **WHEN** `MCP_PROVISIONING_ALLOWED_EMAILS="^.*@bfincont\\.com\\.br$"` e chega `email: "novo@bfincont.com.br"`
- **THEN** o sistema detecta padrão regex, testa o match e cria o usuário

#### Scenario: Claim email ausente
- **WHEN** Bearer chega com `sub` novo sem claim `email`
- **THEN** o servidor retorna `403 Forbidden` com código `EMAIL_CLAIM_MISSING` — não é possível aplicar allowlist

### Requirement: actingUserId dinâmico em cada tools/call
O `McpContext` construído para cada `tools/call` SHALL usar o `actingUserId` resolvido da request atual, nunca um valor de env. Isso garante que múltiplos usuários conectados simultaneamente tenham suas writes atribuídas corretamente.

#### Scenario: Dois usuários simultâneos
- **WHEN** usuário A (sub=auth0|A → userId=1) e usuário B (sub=auth0|B → userId=2) chamam `transactions.create` em paralelo
- **THEN** a transação de A é criada com `criado_por = 1` e a de B com `criado_por = 2`, sem cruzamento

#### Scenario: Tools/list filtrado pelos scopes do token da request
- **WHEN** usuário A (token com `transactions:read`) e usuário B (token com `transactions:write`) chamam `tools/list` simultaneamente
- **THEN** A recebe lista com `transactions.list` e B recebe também `transactions.create/update/delete`

### Requirement: Env vars MCP_SERVICE_ACCOUNT_TOKEN e MCP_SUBJECT_USER_ID não são lidas
O sistema SHALL ignorar completamente as env vars `MCP_SERVICE_ACCOUNT_TOKEN` e `MCP_SUBJECT_USER_ID` em runtime. O schema de config SHALL não validá-las. Caso estejam presentes no `.env`, o processo SHALL iniciar normalmente sem warning especial.

#### Scenario: Env vars antigas presentes não quebram bootstrap
- **WHEN** a aplicação inicia com `.env` contendo `MCP_SUBJECT_USER_ID=uuid-legado` e `MCP_SERVICE_ACCOUNT_TOKEN=xyz`
- **THEN** o processo inicia normalmente; essas vars são simplesmente ignoradas

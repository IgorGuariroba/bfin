## ADDED Requirements

### Requirement: Bootstrap valida token da service account
No início do processo MCP, o sistema SHALL validar o token JWT presente em `MCP_SERVICE_ACCOUNT_TOKEN` usando o mesmo JWKS do provedor OIDC configurado em `OIDC_ISSUER_URL`. A audiência do token SHALL ser igual a `MCP_OIDC_AUDIENCE` (obrigatória, distinta de `OIDC_AUDIENCE` da API HTTP). A validação SHALL cobrir assinatura, expiração (`exp`) e issuer (`iss`).

#### Scenario: Token válido no bootstrap
- **WHEN** o MCP inicia com `MCP_SERVICE_ACCOUNT_TOKEN` válido, emitido por `OIDC_ISSUER_URL`, com `aud` = `MCP_OIDC_AUDIENCE`
- **THEN** o bootstrap conclui, o servidor completa `initialize` e aceita `tools/list`

#### Scenario: Token expirado no bootstrap
- **WHEN** o MCP inicia com um token cuja `exp` já passou
- **THEN** o processo falha com exit code não-zero e imprime em `stderr` uma mensagem indicando expiração e o instante `exp` do token

#### Scenario: Audiência incorreta
- **WHEN** o token foi emitido com `aud` diferente de `MCP_OIDC_AUDIENCE`
- **THEN** o processo falha no bootstrap com erro `TOKEN_INVALID` e mensagem em `stderr` indicando audiência esperada

#### Scenario: Variáveis obrigatórias ausentes
- **WHEN** qualquer uma das variáveis `MCP_SERVICE_ACCOUNT_TOKEN`, `MCP_OIDC_AUDIENCE` ou `MCP_SUBJECT_USER_ID` não está definida
- **THEN** o processo falha no bootstrap identificando cada variável ausente, sem iniciar o servidor

### Requirement: Resolução do usuário alvo da service account
O sistema SHALL ler `MCP_SUBJECT_USER_ID` (UUID) e verificar, no bootstrap, que existe um registro em `usuarios` com esse `id`. Esse usuário é o alvo atribuído a todas as operações de escrita executadas via MCP. O sistema SHALL **não** usar `findOrCreateUser` com as claims do token (a SA não é um humano; o operador provisiona o registro explicitamente).

#### Scenario: Usuário existente na base
- **WHEN** `MCP_SUBJECT_USER_ID` aponta para um registro existente em `usuarios`
- **THEN** o bootstrap carrega o usuário e mantém em memória como "acting user" das invocações

#### Scenario: Usuário inexistente
- **WHEN** `MCP_SUBJECT_USER_ID` aponta para um UUID sem registro correspondente
- **THEN** o bootstrap falha com mensagem clara em `stderr` e exit code não-zero

### Requirement: Extração de escopos do token
O sistema SHALL extrair os escopos concedidos à service account a partir da claim `scope` do token (string separada por espaço, padrão OAuth 2.0). Escopos SHALL usar o formato `<resource>:<action>` (ex.: `transactions:write`). O conjunto extraído SHALL ficar imutável durante o lifetime do processo.

#### Scenario: Claim scope presente
- **WHEN** o token contém `scope: "accounts:read transactions:read transactions:write"`
- **THEN** o sistema registra `Set { "accounts:read", "transactions:read", "transactions:write" }` como escopos ativos

#### Scenario: Claim scope ausente
- **WHEN** o token não contém `scope` nem `scp`
- **THEN** o sistema assume conjunto vazio — o servidor inicia mas `tools/list` retorna `[]` e qualquer `tools/call` é rejeitado por falta de escopo

#### Scenario: Escopo com formato inválido
- **WHEN** a claim `scope` contém um item sem `:` (ex.: `"admin"`)
- **THEN** o sistema ignora o item inválido, registra WARN em `stderr` e usa apenas os itens bem-formados

### Requirement: Enforcement de escopo por tool
O registry de tools SHALL consultar os escopos ativos para decidir visibilidade em `tools/list` e autorização em `tools/call`. Tools cujo `requiredScope` não está no conjunto SHALL ser ocultadas da listagem. Invocações a tools não autorizadas SHALL retornar erro sem executar o handler.

#### Scenario: tools/list filtrado por scope
- **WHEN** o cliente chama `tools/list` e o token concede apenas `accounts:read`
- **THEN** a resposta inclui apenas tools cujo `requiredScope` é `accounts:read`; todas as outras são omitidas

#### Scenario: tools/call sem escopo
- **WHEN** o cliente chama `tools/call` para `transactions.create` mas o token não concede `transactions:write`
- **THEN** o servidor retorna erro JSON-RPC com mensagem de escopo insuficiente e não invoca o service

#### Scenario: Escopo concedido permite execução
- **WHEN** o cliente chama `tools/call` para uma tool cujo `requiredScope` está no conjunto ativo
- **THEN** o servidor prossegue com validação de input, checagem de autorização de conta (quando aplicável) e execução do service

### Requirement: Autorização por conta continua obrigatória
Para tools cujo input contém `contaId`, o sistema SHALL verificar que o `MCP_SUBJECT_USER_ID` tem associação em `conta_usuarios` com papel suficiente para a ação, reusando a lógica compartilhada extraída do plugin HTTP `account-authorization`. A checagem SHALL ocorrer após o scope check e antes da execução do service.

#### Scenario: SA é owner da conta
- **WHEN** a tool `transactions.create` é chamada com `contaId` no qual `MCP_SUBJECT_USER_ID` tem papel `owner`
- **THEN** a invocação prossegue e a transação é criada atribuindo o acting user como criador

#### Scenario: SA é viewer tentando escrever
- **WHEN** a tool `transactions.create` é chamada com `contaId` no qual `MCP_SUBJECT_USER_ID` tem papel `viewer`
- **THEN** o servidor retorna erro forbidden (via `ForbiddenError` do domínio compartilhado) e a transação não é criada

#### Scenario: SA sem associação à conta
- **WHEN** a tool é chamada com `contaId` onde o acting user não tem registro em `conta_usuarios`
- **THEN** o servidor retorna erro forbidden

### Requirement: requestedBy como contexto somente de auditoria
O sistema SHALL aceitar o campo opcional `meta.requestedBy: string` em qualquer `tools/call`. O valor SHALL ser validado (string com até 200 caracteres, sem caracteres de controle) e, se válido, SHALL ser anexado ao logger estruturado da invocação como `requested_by`. O sistema SHALL **nunca** usar esse valor para alterar a identidade, o acting user ou os escopos aplicados.

#### Scenario: requestedBy anexado ao log
- **WHEN** o cliente chama uma tool com `meta.requestedBy: "user-abc"`
- **THEN** o log da invocação contém `requested_by: "user-abc"` mas a decisão de autorização usa apenas os escopos do token

#### Scenario: requestedBy não eleva privilégio
- **WHEN** o cliente chama `tools/call` para uma tool sem o escopo necessário e envia `meta.requestedBy: "admin-user-id"`
- **THEN** o servidor ainda retorna erro de escopo insuficiente — o `requestedBy` é ignorado na decisão e apenas logado

#### Scenario: requestedBy inválido é descartado
- **WHEN** o cliente envia `meta.requestedBy` com mais de 200 caracteres ou contendo bytes de controle
- **THEN** o log é emitido sem `requested_by` (com um WARN separado indicando descarte), e a invocação prossegue normalmente

#### Scenario: requestedBy ausente
- **WHEN** o cliente não envia `meta.requestedBy`
- **THEN** a invocação prossegue normalmente e o log é emitido sem o campo `requested_by`

### Requirement: Separação de audiência entre API HTTP e MCP
O sistema SHALL exigir que tokens usados no MCP tenham audiência igual a `MCP_OIDC_AUDIENCE`, distinta de `OIDC_AUDIENCE` da API HTTP. Um token emitido para a API HTTP SHALL ser rejeitado pelo MCP e vice-versa.

#### Scenario: Token de API HTTP recusado pelo MCP
- **WHEN** `MCP_SERVICE_ACCOUNT_TOKEN` é setado com um token cuja `aud` corresponde a `OIDC_AUDIENCE` (API HTTP) e não a `MCP_OIDC_AUDIENCE`
- **THEN** o bootstrap do MCP falha com `TOKEN_INVALID`

#### Scenario: Token MCP recusado na API HTTP
- **WHEN** um cliente envia o token da service account MCP como Bearer na API HTTP
- **THEN** o `auth-guard` HTTP rejeita o token porque `aud` não corresponde a `OIDC_AUDIENCE`

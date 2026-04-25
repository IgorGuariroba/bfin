## MODIFIED Requirements

### Requirement: Registry de tools por domínio
O servidor SHALL registrar tools MCP organizadas por domínio, cobrindo leitura e escrita das capacidades da BFin. Cada tool SHALL declarar: `name` no formato `<domain>.<action>` ou `<domain>_<action>` (snake_case do catálogo MCP atual), `title` (string ≤ 64 chars, humanizada), `description` factual livre de prompt injection e linguagem promocional, exatamente uma das anotações `readOnlyHint: true` (leitura) ou `destructiveHint: true` (escrita), `inputSchema` (JSON Schema derivado de Zod), `requiredScope` (string `<resource>:<action>` com `action ∈ {read, write, delete}`) e handler.

#### Scenario: tools/list retorna apenas tools autorizadas
- **WHEN** o cliente chama `tools/list`
- **THEN** o servidor retorna apenas as tools cujo `requiredScope` está presente no conjunto de escopos do token da service account, e cada entrada inclui `title` + `readOnlyHint`/`destructiveHint`

#### Scenario: Domínios cobertos
- **WHEN** o servidor inicia com todos os escopos concedidos
- **THEN** `tools/list` inclui pelo menos: `accounts_list`, `accounts_get`, `accounts_create`, `account-members_list`, `account-members_add`, `categories_list`, `categories_create`, `transactions_list`, `transactions_create`, `transactions_update`, `transactions_delete`, `debts_list`, `debts_create`, `debts_pay-installment`, `goals_list`, `goals_create`, `goals_update`, `daily-limit_get`, `daily-limit_set`, `daily-limit_v2_get`, `projections_get`, `mcp_whoami`

#### Scenario: Tool sem escopo no token é ocultada
- **WHEN** o token da service account não inclui `transactions:write` mas inclui `transactions:read`
- **THEN** `tools/list` mostra `transactions_list` mas não `transactions_create`/`update`/`delete`

#### Scenario: Tool sem annotation falha no boot
- **WHEN** o desenvolvedor registra uma tool sem `readOnlyHint` nem `destructiveHint` ou com ambos
- **THEN** o servidor SHALL falhar no startup citando a tool inválida

### Requirement: Execução de tool via tools/call
O servidor SHALL implementar `tools/call` chamando o service correspondente do domínio in-process. O handler SHALL validar o input com Zod antes de invocar o service e SHALL mapear exceções do domínio (`NotFoundError`, `BusinessRuleError`, `ForbiddenError`) para o contrato de erro estruturado: `isError: true` com `content[0].text` JSON `{ code, message, field?, hint? }` onde `code ∈ { "INVALID_INPUT", "NOT_FOUND", "FORBIDDEN", "BUSINESS_RULE", "INTERNAL" }`.

#### Scenario: Invocação bem-sucedida
- **WHEN** o cliente chama `tools/call` com uma tool autorizada e input válido
- **THEN** o servidor executa o service, retorna `content: [{ type: "text", text: <JSON do resultado> }]` e `isError: false`

#### Scenario: Input inválido segundo o schema
- **WHEN** o cliente chama `tools/call` com input que não passa na validação Zod
- **THEN** o servidor retorna `isError: true` com `content[0].text` parseável como JSON `{ "code": "INVALID_INPUT", "field": <caminho>, "message": <descrição>, "hint": <remediação> }`, sem invocar o service

#### Scenario: Domínio lança NotFoundError
- **WHEN** a tool `transactions_update` é chamada com um `transactionId` inexistente
- **THEN** o servidor retorna `isError: true` com `code: "NOT_FOUND"` no JSON estruturado, sem derrubar o processo

#### Scenario: Domínio lança ForbiddenError por autorização de conta
- **WHEN** a tool é chamada com `contaId` onde o usuário da service account não tem papel suficiente
- **THEN** o servidor retorna `isError: true` com `code: "FORBIDDEN"`, sem expor detalhes internos

#### Scenario: Erro inesperado retorna INTERNAL
- **WHEN** o handler lança erro não classificado
- **THEN** o servidor retorna `isError: true` com `code: "INTERNAL"` e mensagem genérica

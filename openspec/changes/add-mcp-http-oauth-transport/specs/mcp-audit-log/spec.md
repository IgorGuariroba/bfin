## ADDED Requirements

### Requirement: Audit log estruturado por tool call
O sistema SHALL emitir um log `pino` nível `info` para cada invocação de `tools/call`, contendo os campos: `event: "mcp.tool_call"`, `user_id` (acting user resolvido), `sub` (claim do token), `tool` (nome), `scope` (scope requerido pela tool), `duration_ms`, `outcome` (`"ok"` ou `"error"`), `input_hash` (SHA-256 dos primeiros 4KB do payload), `error_code` (quando `outcome = "error"`). O log SHALL ser emitido mesmo se a tool falhar.

#### Scenario: Invocação bem-sucedida
- **WHEN** `transactions.create` executa com sucesso em 120ms
- **THEN** um log `info` é emitido com `event: "mcp.tool_call"`, `outcome: "ok"`, `duration_ms: 120`, `input_hash: "<sha256>"`

#### Scenario: Invocação com erro de negócio
- **WHEN** `transactions.create` falha com `BusinessRuleError` traduzido para código `-32002`
- **THEN** um log `info` é emitido com `outcome: "error"`, `error_code: -32002`, e o payload do input hasheado

#### Scenario: Invocação com erro inesperado
- **WHEN** `categories.list` falha por exceção não mapeada
- **THEN** dois logs são emitidos: um `info` de audit com `outcome: "error"` e `error_code: -32603`; um `error` separado com o stack completo (fora do formato de audit)

### Requirement: Audit log não loga valores sensíveis
O audit log SHALL registrar apenas o hash SHA-256 do payload de input, nunca os valores brutos. Campos como `descricao`, `valor`, `email`, `nome` SHALL ficar de fora. O campo `tool` e `scope` são informativos — não expõem PII.

#### Scenario: Payload com descrição privada
- **WHEN** `transactions.create` recebe `{"valor": 500, "descricao": "Psicóloga Dra. Fulana"}`
- **THEN** o log contém `input_hash` do JSON serializado mas **nenhum** campo `valor`, `descricao` ou derivados é emitido

#### Scenario: Hash estável para mesmo payload
- **WHEN** duas invocações recebem o mesmo payload serializado
- **THEN** ambos logs contêm o mesmo `input_hash` (permite detectar retries idempotentes e padrões de abuse)

### Requirement: requestedBy permanece como contexto de auditoria
Quando o cliente envia `meta.requestedBy` em `tools/call`, o sistema SHALL incluir o valor no log como campo `requested_by`, aplicando a mesma validação existente (string ≤200 chars, sem bytes de controle). O valor SHALL continuar **nunca** participar de decisões de autorização.

#### Scenario: requestedBy anexado
- **WHEN** cliente chama tool com `meta.requestedBy: "agent-a"`
- **THEN** o log inclui `requested_by: "agent-a"` ao lado de `sub`, `user_id`

#### Scenario: requestedBy inválido descartado
- **WHEN** `meta.requestedBy` excede 200 caracteres
- **THEN** o log de audit é emitido sem `requested_by` e um log `warn` separado registra o descarte

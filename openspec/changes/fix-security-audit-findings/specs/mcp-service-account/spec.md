# mcp-service-account

## MODIFIED Requirements

### Requirement: Autorização por conta continua obrigatória
Para tools cujo input contém `contaId`, o sistema SHALL verificar que o `MCP_SUBJECT_USER_ID` tem associação em `conta_usuarios` com papel suficiente para a ação, reusando a lógica compartilhada extraída do plugin HTTP `account-authorization`. Quando o input também contém um `id` de recurso (ex.: `id` de transação), o sistema SHALL buscar o recurso pelo `id` e usar o `contaId` REAL do recurso para a autorização, não o `contaId` passado no input. A checagem SHALL ocorrer após o scope check e antes da execução do service.

#### Scenario: SA é owner da conta real do recurso
- **WHEN** a tool `transactions.delete` é chamada com `id` de uma transação cujo `contaId` real pertence ao `MCP_SUBJECT_USER_ID` como `owner`
- **THEN** a invocação prossegue e a transação é deletada

#### Scenario: SA passa contaId diferente do recurso
- **WHEN** a tool `transactions.delete` é chamada com `contaId` onde o SA é owner, mas o `id` da transação pertence a outra conta
- **THEN** o servidor retorna erro `403 Forbidden` (via `ForbiddenError`) e a transação não é deletada

#### Scenario: SA é viewer tentando modificar recurso de outra conta
- **WHEN** a tool `transactions.update` é chamada com `id` de transação de uma conta onde o SA tem papel `viewer`
- **THEN** o servidor retorna erro forbidden e a transação não é atualizada

#### Scenario: Recurso não encontrado
- **WHEN** a tool é chamada com um `id` de recurso inexistente
- **THEN** o servidor retorna erro `404 Not Found` antes de checar autorização de conta

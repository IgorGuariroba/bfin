# transaction-management

## MODIFIED Requirements

### Requirement: Atualizar movimentação
O sistema SHALL permitir que um usuário com papel `owner` atualize uma movimentação existente, inclusive cancelar recorrência ou definir data limite. Via MCP HTTP, o sistema SHALL validar que o `id` da movimentação pertence à conta real do recurso antes de aplicar a atualização.

#### Scenario: Atualização parcial bem-sucedida via API HTTP
- **WHEN** um usuário com papel `owner` envia `PUT /movimentacoes/{id}` com campos válidos
- **THEN** o sistema atualiza a movimentação e retorna `200 OK`

#### Scenario: Atualização parcial bem-sucedida via MCP
- **WHEN** a tool `transactions.update` é chamada com `id` válido e `contaId` correspondente ao recurso real
- **THEN** o sistema atualiza a movimentação e retorna o resultado

#### Scenario: IDOR bloqueado no MCP update
- **WHEN** a tool `transactions.update` é chamada com `id` de transação que pertence a outra conta, mesmo que o `contaId` do input seja de uma conta onde o usuário é owner
- **THEN** o sistema retorna `403 Forbidden` e não altera a transação

#### Scenario: Cancelamento de recorrência
- **WHEN** um usuário com papel `owner` envia `PUT /movimentacoes/{id}` com `recorrente: false`
- **THEN** o sistema define `recorrente = false`, limpa `data_fim` e retorna `200 OK`

#### Scenario: Definição de data limite de recorrência
- **WHEN** um usuário com papel `owner` envia `PUT /movimentacoes/{id}` com `data_fim: "2025-06-30"`
- **THEN** o sistema atualiza `data_fim` e retorna `200 OK`

#### Scenario: Movimentação não encontrada
- **WHEN** um usuário envia `PUT /movimentacoes/{id}` para um ID inexistente
- **THEN** o sistema retorna `404 Not Found` com código `RESOURCE_NOT_FOUND`

### Requirement: Deletar movimentação
O sistema SHALL permitir que um usuário com papel `owner` remova uma movimentação manual. Movimentações geradas automaticamente pelo sistema (pagamento de parcela) MUST ser identificadas pela coluna `movimentacoes.parcela_divida_id IS NOT NULL` (FK para `parcelas_divida(id)`) e o sistema MUST rejeitar `DELETE /movimentacoes/{id}` nessas movimentações com `422 Unprocessable Entity` e `code: "SYSTEM_GENERATED_RESOURCE"`. Via MCP HTTP, o sistema SHALL validar que o `id` da movimentação pertence à conta real do recurso antes de deletar.

#### Scenario: Deleção bem-sucedida via API HTTP
- **WHEN** um usuário com papel `owner` envia `DELETE /movimentacoes/{id}` para uma movimentação manual (`parcela_divida_id IS NULL`)
- **THEN** o sistema remove a movimentação e retorna `200 OK`

#### Scenario: Deleção bem-sucedida via MCP
- **WHEN** a tool `transactions.delete` é chamada com `id` válido de uma transação manual cuja conta real pertence ao usuário como owner
- **THEN** o sistema remove a movimentação e retorna `{ deleted: true }`

#### Scenario: IDOR bloqueado no MCP delete
- **WHEN** a tool `transactions.delete` é chamada com `id` de transação de outra conta, mesmo que o `contaId` do input seja de uma conta onde o usuário é owner
- **THEN** o sistema retorna `403 Forbidden` e não remove a transação

#### Scenario: Tentativa de deletar movimentação gerada por pagamento
- **WHEN** um `owner` envia `DELETE /movimentacoes/{id}` para uma movimentação com `parcela_divida_id` apontando para uma parcela existente
- **THEN** o sistema retorna `422 Unprocessable Entity` com `code: "SYSTEM_GENERATED_RESOURCE"` e a movimentação permanece intacta

#### Scenario: Movimentação inexistente
- **WHEN** um `owner` envia `DELETE /movimentacoes/{id}` com ID que não existe
- **THEN** o sistema retorna `404 Not Found` com `code: "RESOURCE_NOT_FOUND"`

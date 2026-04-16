## MODIFIED Requirements

### Requirement: Deletar movimentação
O sistema SHALL permitir que um usuário com papel `owner` remova uma movimentação manual. Movimentações geradas automaticamente pelo sistema (pagamento de parcela) MUST ser identificadas pela coluna `movimentacoes.parcela_divida_id IS NOT NULL` (FK para `parcelas_divida(id)`) e o sistema MUST rejeitar `DELETE /movimentacoes/{id}` nessas movimentações com `422 Unprocessable Entity` e `code: "SYSTEM_GENERATED_RESOURCE"`.

#### Scenario: Deleção bem-sucedida
- **WHEN** um usuário com papel `owner` envia `DELETE /movimentacoes/{id}` para uma movimentação manual (`parcela_divida_id IS NULL`)
- **THEN** o sistema remove a movimentação e retorna `200 OK`

#### Scenario: Tentativa de deletar movimentação gerada por pagamento
- **WHEN** um `owner` envia `DELETE /movimentacoes/{id}` para uma movimentação com `parcela_divida_id` apontando para uma parcela existente
- **THEN** o sistema retorna `422 Unprocessable Entity` com `code: "SYSTEM_GENERATED_RESOURCE"` e a movimentação permanece intacta

#### Scenario: Movimentação inexistente
- **WHEN** um `owner` envia `DELETE /movimentacoes/{id}` com ID que não existe
- **THEN** o sistema retorna `404 Not Found` com `code: "RESOURCE_NOT_FOUND"`

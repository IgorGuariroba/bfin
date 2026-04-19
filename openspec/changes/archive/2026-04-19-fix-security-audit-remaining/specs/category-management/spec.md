# category-management

## MODIFIED Requirements

### Requirement: Deletar categoria
Um admin SHALL poder deletar uma categoria via `DELETE /categorias/{categoriaId}`. A deleção MUST ser recusada se existirem movimentações ou dívidas vinculadas à categoria. O sistema SHALL verificar vínculos usando queries parametrizadas do ORM, nunca concatenando input do usuário em SQL dinâmico.

#### Scenario: Admin deleta categoria sem vínculos
- **WHEN** um admin envia `DELETE /categorias/{categoriaId}` e a categoria não possui registros vinculados
- **THEN** o sistema retorna `200 OK`

#### Scenario: Categoria com registros vinculados
- **WHEN** um admin envia `DELETE /categorias/{categoriaId}` e existem movimentações ou dívidas vinculadas
- **THEN** o sistema retorna `422 Unprocessable Entity` com mensagem indicando registros dependentes

#### Scenario: Categoria não encontrada para deleção
- **WHEN** um admin envia `DELETE /categorias/{categoriaId}` com um ID inexistente
- **THEN** o sistema retorna `404 Not Found`

#### Scenario: Tentativa de SQL Injection na verificação de vínculos
- **WHEN** o sistema verifica vínculos de uma categoria
- **THEN** o valor do `categoriaId` é tratado como parâmetro da query, não como parte do SQL, impedindo injeção de SQL malicioso

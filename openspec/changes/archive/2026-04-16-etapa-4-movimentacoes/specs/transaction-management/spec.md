## ADDED Requirements

### Requirement: Criar movimentação
O sistema SHALL permitir que um usuário com papel `owner` em uma conta registre uma movimentação financeira (receita ou despesa).

#### Scenario: Criação bem-sucedida de despesa
- **WHEN** um usuário autenticado com papel `owner` envia `POST /movimentacoes` com `contaId`, `tipo: "despesa"`, `categoriaId` de categoria do tipo despesa, `valor > 0` e `data` válida
- **THEN** o sistema cria a movimentação e retorna `201 Created` com os dados da movimentação

#### Scenario: Validação de tipo vs categoria incompatível
- **WHEN** um usuário envia `POST /movimentacoes` com `tipo: "receita"` e `categoriaId` de categoria do tipo despesa
- **THEN** o sistema retorna `422 Unprocessable Entity` com código `BUSINESS_RULE_VIOLATION`

#### Scenario: Validação de categoria inexistente
- **WHEN** um usuário envia `POST /movimentacoes` com `categoriaId` que não existe no banco
- **THEN** o sistema retorna `422 Unprocessable Entity` com código `BUSINESS_RULE_VIOLATION`

#### Scenario: data_fim sem recorrência
- **WHEN** um usuário envia `POST /movimentacoes` com `recorrente: false` e `data_fim` preenchida
- **THEN** o sistema retorna `422 Unprocessable Entity` com código `BUSINESS_RULE_VIOLATION`

#### Scenario: Viewer tenta criar movimentação
- **WHEN** um usuário com papel `viewer` envia `POST /movimentacoes`
- **THEN** o sistema retorna `403 Forbidden` com código `INSUFFICIENT_PERMISSIONS`

### Requirement: Atualizar movimentação
O sistema SHALL permitir que um usuário com papel `owner` atualize uma movimentação existente, inclusive cancelar recorrência ou definir data limite.

#### Scenario: Atualização parcial bem-sucedida
- **WHEN** um usuário com papel `owner` envia `PUT /movimentacoes/{id}` com campos válidos
- **THEN** o sistema atualiza a movimentação e retorna `200 OK`

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
O sistema SHALL permitir que um usuário com papel `owner` remova uma movimentação manual. Movimentações geradas automaticamente pelo sistema (pagamento de parcela) não podem ser deletadas.

#### Scenario: Deleção bem-sucedida
- **WHEN** um usuário com papel `owner` envia `DELETE /movimentacoes/{id}` para uma movimentação manual
- **THEN** o sistema remove a movimentação e retorna `200 OK`

#### Scenario: Tentativa de deletar movimentação do sistema
- **WHEN** um usuário envia `DELETE /movimentacoes/{id}` para uma movimentação gerada automaticamente por pagamento de parcela
- **THEN** o sistema retorna `422 Unprocessable Entity` com código `SYSTEM_GENERATED_RESOURCE`

### Requirement: Listar movimentações
O sistema SHALL listar movimentações de uma conta com paginação e filtros, acessível a `owner` e `viewer`.

#### Scenario: Listagem com filtros combinados
- **WHEN** um usuário autenticado envia `GET /movimentacoes?contaId={id}&tipo=despesa&data_inicio=2024-01-01&data_fim=2024-01-31&page=1&limit=10`
- **THEN** o sistema retorna `200 OK` com `data` (array de movimentações filtradas) e `pagination` contendo `page`, `limit`, `total` e `totalPages`, no mesmo formato usado em `/contas` e `/categorias`

#### Scenario: Listagem sem contaId
- **WHEN** um usuário envia `GET /movimentacoes` sem o parâmetro `contaId`
- **THEN** o sistema retorna `400 Bad Request` com código `VALIDATION_ERROR`

#### Scenario: Busca por descrição
- **WHEN** um usuário envia `GET /movimentacoes?contaId={id}&busca=supermercado`
- **THEN** o sistema retorna `200 OK` contendo apenas movimentações cuja descrição corresponda parcialmente à busca (case-insensitive)

### Requirement: Invalidação de projeção após mutação
O sistema SHALL marcar projeções persistidas como `invalidada` (valor do campo `status` na tabela `projecao`) após criação, atualização ou exclusão de movimentações, de forma síncrona, antes de responder ao cliente. A emissão do evento `projecao:recalcular` e o recálculo assíncrono são responsabilidade do motor de projeção (Etapa 6) e não fazem parte desta capability.

#### Scenario: Projeção invalidada após criar movimentação
- **WHEN** uma movimentação é criada com sucesso na data `YYYY-MM-DD`
- **THEN** o sistema executa, antes de responder, um UPDATE equivalente a `UPDATE projecao SET status = 'invalidada' WHERE conta_id = {contaId} AND mes >= 'YYYY-MM'`, afetando o mês da movimentação e todos os meses posteriores já persistidos

#### Scenario: Projeção invalidada após atualizar data da movimentação
- **WHEN** uma movimentação tem sua `data` alterada de `2024-05-10` para `2024-03-15`
- **THEN** o sistema invalida projeções a partir do menor mês entre os dois (`2024-03`) em diante

#### Scenario: Invalidação quando a tabela projecao ainda não existe
- **WHEN** uma movimentação é criada antes da Etapa 6 ter criado a tabela `projecao`
- **THEN** o sistema trata o erro `42P01` (undefined_table) do PostgreSQL como no-op e conclui a mutação com sucesso (`201 Created`)

# transaction-management — Delta

## ADDED Requirements

### Requirement: Validação de valor positivo
O sistema SHALL rejeitar qualquer movimentação cuja quantia `valor` seja menor ou igual a zero em `POST /movimentacoes` e `PUT /movimentacoes/{id}`, retornando `422 Unprocessable Entity` com código `BUSINESS_RULE_VIOLATION`.

#### Scenario: Criação com valor zero
- **WHEN** um usuário autenticado com papel `owner` envia `POST /movimentacoes` com `valor: 0` e demais campos obrigatórios válidos
- **THEN** o sistema retorna `422 Unprocessable Entity` com `code: "BUSINESS_RULE_VIOLATION"` e mensagem indicando que `valor` deve ser maior que zero

#### Scenario: Criação com valor negativo
- **WHEN** um usuário autenticado com papel `owner` envia `POST /movimentacoes` com `valor: -50` e demais campos obrigatórios válidos
- **THEN** o sistema retorna `422 Unprocessable Entity` com `code: "BUSINESS_RULE_VIOLATION"` e mensagem indicando que `valor` deve ser maior que zero

#### Scenario: Atualização reduzindo valor para zero
- **WHEN** um usuário autenticado com papel `owner` envia `PUT /movimentacoes/{id}` com `valor: 0`
- **THEN** o sistema retorna `422 Unprocessable Entity` com `code: "BUSINESS_RULE_VIOLATION"` e não persiste a alteração

#### Scenario: Atualização para valor negativo
- **WHEN** um usuário autenticado com papel `owner` envia `PUT /movimentacoes/{id}` com `valor: -10`
- **THEN** o sistema retorna `422 Unprocessable Entity` com `code: "BUSINESS_RULE_VIOLATION"` e não persiste a alteração

## MODIFIED Requirements

### Requirement: Listar movimentações
O sistema SHALL listar movimentações de uma conta com paginação e filtros, acessível a `owner` e `viewer`.

#### Scenario: Listagem com filtros combinados
- **WHEN** um usuário autenticado envia `GET /movimentacoes?contaId={id}&tipo=despesa&data_inicio=2024-01-01&data_fim=2024-01-31&page=1&limit=10`
- **THEN** o sistema retorna `200 OK` com `data` (array de movimentações filtradas) e `pagination` contendo `page`, `limit`, `total` e `totalPages`, no mesmo formato usado em `/contas` e `/categorias`

#### Scenario: Listagem sem contaId
- **WHEN** um usuário envia `GET /movimentacoes` sem o parâmetro `contaId`
- **THEN** o sistema retorna `422 Unprocessable Entity` com código `VALIDATION_ERROR`, alinhado à padronização de status de `plano.md §10`

#### Scenario: Busca por descrição
- **WHEN** um usuário envia `GET /movimentacoes?contaId={id}&busca=supermercado`
- **THEN** o sistema retorna `200 OK` contendo apenas movimentações cuja descrição corresponda parcialmente à busca (case-insensitive)

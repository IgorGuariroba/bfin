# transaction-management Specification

## Purpose

Define a capability de movimentações financeiras (receitas e despesas): CRUD completo vinculado a contas e categorias, com validação de consistência entre tipo da movimentação e tipo da categoria, filtros e paginação na listagem, invalidação síncrona de projeções persistidas após mutações, e emissão de evento `projecao:recalcular` para recálculo assíncrono pelo motor de projeção. Apenas `owner` pode criar/editar/excluir; `viewer` tem acesso somente leitura via listagem.

## Requirements

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

### Requirement: Invalidação de projeção após mutação
O sistema SHALL marcar projeções persistidas como `invalidada` (valor do campo `status` na tabela `projecao`) após criação, atualização ou exclusão de movimentações, de forma síncrona, antes de responder ao cliente. Após concluir a invalidação síncrona e a resposta HTTP de sucesso, o sistema MUST emitir o evento `projecao:recalcular` via `eventBus` (singleton `EventEmitter`) com payload `{ contaId, mesInicial }` onde `mesInicial` é o menor mês afetado no formato `YYYY-MM`. A emissão do evento MUST ocorrer mesmo que a tabela `projecao` ainda não exista (o listener do motor decidirá se recalcula). A execução do listener (recálculo assíncrono) é responsabilidade do motor de projeção e não bloqueia a resposta HTTP.

#### Scenario: Projeção invalidada após criar movimentação
- **WHEN** uma movimentação é criada com sucesso na data `YYYY-MM-DD`
- **THEN** o sistema executa, antes de responder, um UPDATE equivalente a `UPDATE projecao SET status = 'invalidada' WHERE conta_id = {contaId} AND mes >= 'YYYY-MM'`, afetando o mês da movimentação e todos os meses posteriores já persistidos

#### Scenario: Projeção invalidada após atualizar data da movimentação
- **WHEN** uma movimentação tem sua `data` alterada de `2024-05-10` para `2024-03-15`
- **THEN** o sistema invalida projeções a partir do menor mês entre os dois (`2024-03`) em diante

#### Scenario: Invalidação quando a tabela projecao ainda não existe
- **WHEN** uma movimentação é criada antes da Etapa 6 ter criado a tabela `projecao`
- **THEN** o sistema trata o erro `42P01` (undefined_table) do PostgreSQL como no-op e conclui a mutação com sucesso (`201 Created`)

#### Scenario: Emissão de projecao:recalcular após criar movimentação
- **WHEN** uma movimentação é criada com sucesso na data `2024-03-15` para a conta `X`
- **THEN** o sistema emite, após a invalidação síncrona, o evento `projecao:recalcular` com payload `{ contaId: X, mesInicial: "2024-03" }`

#### Scenario: Emissão de projecao:recalcular após atualizar data
- **WHEN** uma movimentação tem sua `data` alterada de `2024-05-10` para `2024-03-15`
- **THEN** o sistema emite o evento `projecao:recalcular` com `mesInicial: "2024-03"` (menor dos dois meses)

#### Scenario: Emissão de projecao:recalcular após deletar movimentação
- **WHEN** uma movimentação com `data=2024-04-10` é deletada com sucesso
- **THEN** o sistema emite `projecao:recalcular` com `mesInicial: "2024-04"`

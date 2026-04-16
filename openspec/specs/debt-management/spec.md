# debt-management Specification

## Purpose

Define a capability de gestão de dívidas parceladas: criação de dívidas com geração automática de parcelas, listagem com filtros e paginação, deleção restrita a dívidas sem pagamentos, e invalidação síncrona de projeções persistidas após mutações. Apenas `owner` pode criar/deletar; `viewer` tem acesso somente leitura via listagem.

## Requirements

### Requirement: Criar dívida com geração automática de parcelas
O sistema SHALL permitir que um usuário com papel `owner` em uma conta registre uma dívida via `POST /dividas` com `contaId`, `descricao`, `categoriaId` (tipo `divida`), `valor_total > 0`, `total_parcelas >= 1` e `data_inicio` (vencimento da 1ª parcela). O sistema MUST gerar automaticamente N registros em `parcelas_divida` com vencimentos mensais sequenciais a partir de `data_inicio`, aplicando arredondamento em que as N-1 primeiras parcelas recebem `trunc(valor_total / total_parcelas, 2)` e a última absorve a diferença para garantir que a soma seja exatamente `valor_total`. A criação da dívida e das parcelas MUST ocorrer em uma única transação atômica.

#### Scenario: Criação com divisão exata
- **WHEN** um `owner` envia `POST /dividas` com `valor_total: 3000.00`, `total_parcelas: 10`, `data_inicio: "2024-02-15"` e demais campos válidos
- **THEN** o sistema retorna `201 Created` com a dívida e 10 parcelas de `valor: 300.00`, com vencimentos `2024-02-15`, `2024-03-15`, ..., `2024-11-15`

#### Scenario: Arredondamento com resíduo na última parcela
- **WHEN** um `owner` envia `POST /dividas` com `valor_total: 1000.00`, `total_parcelas: 3`, `data_inicio: "2024-01-10"`
- **THEN** o sistema cria parcelas com `valor: 333.33`, `333.33`, `333.34` nessa ordem, cuja soma é exatamente `1000.00`

#### Scenario: Categoria de tipo incorreto
- **WHEN** um `owner` envia `POST /dividas` com `categoriaId` de uma categoria cujo tipo é `despesa`
- **THEN** o sistema retorna `422 Unprocessable Entity` com `code: "BUSINESS_RULE_VIOLATION"`

#### Scenario: Valor total não positivo
- **WHEN** um `owner` envia `POST /dividas` com `valor_total: 0` ou `valor_total: -100`
- **THEN** o sistema retorna `422 Unprocessable Entity` com `code: "BUSINESS_RULE_VIOLATION"`

#### Scenario: Total de parcelas inválido
- **WHEN** um `owner` envia `POST /dividas` com `total_parcelas: 0` ou negativo
- **THEN** o sistema retorna `422 Unprocessable Entity` com `code: "BUSINESS_RULE_VIOLATION"`

#### Scenario: Viewer tenta criar dívida
- **WHEN** um `viewer` envia `POST /dividas` para uma conta onde possui apenas leitura
- **THEN** o sistema retorna `403 Forbidden` com `code: "INSUFFICIENT_PERMISSIONS"`

#### Scenario: Vencimentos em mês sem o dia correspondente
- **WHEN** um `owner` envia `POST /dividas` com `data_inicio: "2024-01-31"` e `total_parcelas: 3`
- **THEN** o sistema cria parcelas com vencimentos `2024-01-31`, `2024-02-29`, `2024-03-31` (o motor usa fim-de-mês quando o dia não existe no mês seguinte)

### Requirement: Listar dívidas de uma conta
O sistema SHALL listar dívidas vinculadas a uma conta via `GET /dividas?contaId={id}` com paginação (`page`, `limit`) e filtro opcional `status` (`pendente` | `quitada`). A listagem MUST estar disponível a `owner` e `viewer`. Uma dívida é `quitada` quando todas as suas parcelas possuem `data_pagamento` preenchido; caso contrário é `pendente`. Cada item retornado MUST incluir `total_parcelas`, `parcelas_pagas` e `parcelas_pendentes` derivados em tempo real.

#### Scenario: Listagem sem filtros
- **WHEN** um usuário autenticado envia `GET /dividas?contaId={id}&page=1&limit=10`
- **THEN** o sistema retorna `200 OK` com `data` contendo dívidas da conta e `pagination` no formato `{ page, limit, total, totalPages, hasNext, hasPrev }`

#### Scenario: Filtro por status pendente
- **WHEN** um usuário envia `GET /dividas?contaId={id}&status=pendente`
- **THEN** o sistema retorna apenas dívidas com ao menos uma parcela com `data_pagamento IS NULL`

#### Scenario: Filtro por status quitada
- **WHEN** um usuário envia `GET /dividas?contaId={id}&status=quitada`
- **THEN** o sistema retorna apenas dívidas onde todas as parcelas possuem `data_pagamento` preenchido

#### Scenario: Sem contaId
- **WHEN** um usuário envia `GET /dividas` sem `contaId`
- **THEN** o sistema retorna `422 Unprocessable Entity` com `code: "VALIDATION_ERROR"`

#### Scenario: Usuário sem acesso à conta
- **WHEN** um usuário não associado a uma conta envia `GET /dividas?contaId={id}` daquela conta
- **THEN** o sistema retorna `403 Forbidden` com `code: "INSUFFICIENT_PERMISSIONS"`

### Requirement: Deletar dívida sem pagamentos
O sistema SHALL permitir que um `owner` remova uma dívida via `DELETE /dividas/{dividaId}` SOMENTE quando nenhuma das suas parcelas possui `data_pagamento` preenchido. Quando ao menos uma parcela foi paga, o sistema MUST retornar `422 Unprocessable Entity` com `code: "DEBT_HAS_PAYMENTS"`. A deleção autorizada MUST remover em cascata todas as parcelas associadas.

#### Scenario: Deleção bem-sucedida
- **WHEN** um `owner` envia `DELETE /dividas/{dividaId}` para uma dívida cujas parcelas estão todas com `data_pagamento IS NULL`
- **THEN** o sistema retorna `200 OK` e remove a dívida e todas as suas parcelas

#### Scenario: Bloqueio quando há parcela paga
- **WHEN** um `owner` envia `DELETE /dividas/{dividaId}` para uma dívida onde ao menos uma parcela possui `data_pagamento` preenchido
- **THEN** o sistema retorna `422 Unprocessable Entity` com `code: "DEBT_HAS_PAYMENTS"` e não remove a dívida nem as parcelas

#### Scenario: Dívida inexistente
- **WHEN** um `owner` envia `DELETE /dividas/{dividaId}` com ID que não existe
- **THEN** o sistema retorna `404 Not Found` com `code: "RESOURCE_NOT_FOUND"`

#### Scenario: Viewer tenta deletar
- **WHEN** um `viewer` envia `DELETE /dividas/{dividaId}` para uma conta onde tem apenas leitura
- **THEN** o sistema retorna `403 Forbidden` com `code: "INSUFFICIENT_PERMISSIONS"`

### Requirement: Invalidação de projeção após mutação de dívida
O sistema SHALL marcar projeções persistidas como `invalidada` de forma síncrona (antes de responder ao cliente) após criação ou deleção de dívida. O UPDATE MUST afetar o mês derivado de `data_inicio` (formato `YYYY-MM`) e todos os meses posteriores já persistidos da mesma conta. Se a tabela `projecao` não existir ainda, o sistema MUST tratar o erro PostgreSQL `42P01` como no-op e concluir a mutação com sucesso.

#### Scenario: Invalidação após POST /dividas
- **WHEN** uma dívida é criada com `data_inicio: "2024-02-15"`
- **THEN** o sistema executa, antes de responder `201`, um UPDATE equivalente a `UPDATE projecao SET status = 'invalidada' WHERE conta_id = {contaId} AND mes >= '2024-02'`

#### Scenario: Invalidação após DELETE /dividas
- **WHEN** uma dívida com `data_inicio: "2024-02-15"` é deletada com sucesso
- **THEN** o sistema invalida projeções a partir de `2024-02` antes de responder `200`

#### Scenario: Tabela projecao ainda não existe
- **WHEN** uma dívida é criada antes da Etapa 6 ter criado a tabela `projecao`
- **THEN** o sistema conclui a criação normalmente retornando `201 Created` (erro `42P01` é engolido)

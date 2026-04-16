# installment-payment Specification

## Purpose

Define a capability de confirmação de pagamento de parcelas de dívidas: registro de pagamento com data, geração automática de movimentação vinculada, proteção contra pagamento duplicado, e invalidação síncrona de projeções persistidas. Apenas `owner` pode confirmar pagamentos.

## Requirements

### Requirement: Confirmar pagamento de parcela
O sistema SHALL permitir que um `owner` confirme o pagamento de uma parcela via `PATCH /dividas/{dividaId}/parcelas/{parcelaId}/pagamento` com `data_pagamento` (obrigatória, formato `YYYY-MM-DD`). A operação MUST ocorrer em uma única transação que: (1) bloqueia a parcela com lock pessimista para evitar race condition; (2) preenche `data_pagamento`; (3) gera automaticamente uma `Movimentacao` vinculada à parcela via `movimentacoes.parcela_divida_id`; (4) invalida projeções a partir do menor mês entre `data_pagamento` e `data_vencimento`. Pagamento antecipado (`data_pagamento < data_vencimento`) MUST ser aceito.

#### Scenario: Confirmação bem-sucedida
- **WHEN** um `owner` envia `PATCH /dividas/{dividaId}/parcelas/{parcelaId}/pagamento` com `{"data_pagamento": "2024-02-10"}` para uma parcela pendente
- **THEN** o sistema retorna `200 OK` com a parcela contendo `data_pagamento: "2024-02-10"` e um campo `movimentacao_gerada` aninhado com `id`, `tipo`, `valor` e `data` da despesa criada

#### Scenario: Pagamento antecipado
- **WHEN** um `owner` confirma pagamento com `data_pagamento: "2024-02-10"` em uma parcela com `data_vencimento: "2024-02-15"`
- **THEN** o sistema aceita e retorna `200 OK`

#### Scenario: Parcela inexistente
- **WHEN** um `owner` envia `PATCH /dividas/{dividaId}/parcelas/{parcelaId}/pagamento` com IDs que não existem ou não pertencem à dívida informada
- **THEN** o sistema retorna `404 Not Found` com `code: "RESOURCE_NOT_FOUND"`

#### Scenario: Viewer tenta confirmar pagamento
- **WHEN** um `viewer` envia `PATCH /dividas/{dividaId}/parcelas/{parcelaId}/pagamento`
- **THEN** o sistema retorna `403 Forbidden` com `code: "INSUFFICIENT_PERMISSIONS"`

### Requirement: Bloquear pagamento de parcela já paga
O sistema SHALL rejeitar `PATCH /dividas/{dividaId}/parcelas/{parcelaId}/pagamento` quando a parcela já possui `data_pagamento` preenchido, retornando `422 Unprocessable Entity` com `code: "ALREADY_PAID"` e sem gerar nova movimentação.

#### Scenario: Tentativa de pagar parcela já quitada
- **WHEN** um `owner` envia `PATCH .../pagamento` em uma parcela cujo `data_pagamento` não é nulo
- **THEN** o sistema retorna `422 Unprocessable Entity` com `code: "ALREADY_PAID"` e não altera estado nem gera movimentação

### Requirement: Movimentação gerada automaticamente por pagamento
Quando um pagamento é confirmado, o sistema MUST inserir um novo registro em `movimentacoes` com: `conta_id` igual à conta da dívida, `usuario_id` igual ao usuário autenticado, `categoria_id` igual à categoria da dívida, `valor` igual ao `valor` da parcela, `data` igual à `data_pagamento` informada, `recorrente = false`, `descricao` derivada da descrição da dívida e do número da parcela (ex.: `"Parcela 1/10 — Sofá"`), e `parcela_divida_id` igual ao `id` da parcela. A movimentação gerada MUST estar vinculada à parcela via FK `movimentacoes.parcela_divida_id → parcelas_divida.id`.

#### Scenario: Vínculo parcela↔movimentação
- **WHEN** um pagamento é confirmado com sucesso
- **THEN** existe uma linha em `movimentacoes` com `parcela_divida_id` igual ao `id` da parcela paga, cujo `valor` é igual ao `valor` da parcela e `data` igual à `data_pagamento`

#### Scenario: Usuário autenticado registra autoria da movimentação
- **WHEN** um `owner` diferente do usuário que criou a dívida confirma o pagamento
- **THEN** a `movimentacao_gerada` registra o `usuario_id` do `owner` que confirmou, não do criador da dívida

### Requirement: Invalidação de projeção após pagamento
O sistema SHALL marcar projeções como `invalidada` de forma síncrona após confirmar pagamento, cobrindo tanto o mês de `data_pagamento` quanto o mês de `data_vencimento` — invalidando a partir do menor deles e todos os meses posteriores. Se a tabela `projecao` ainda não existir, o erro PostgreSQL `42P01` MUST ser tratado como no-op.

#### Scenario: Pagamento no mesmo mês do vencimento
- **WHEN** uma parcela com `data_vencimento: "2024-02-15"` recebe pagamento em `"2024-02-20"`
- **THEN** o sistema invalida projeções com `mes >= '2024-02'` antes de responder `200`

#### Scenario: Pagamento antecipado em mês anterior
- **WHEN** uma parcela com `data_vencimento: "2024-03-15"` recebe pagamento em `"2024-02-28"`
- **THEN** o sistema invalida projeções com `mes >= '2024-02'` (menor dos dois meses)

#### Scenario: Tabela projecao inexistente
- **WHEN** um pagamento é confirmado antes da tabela `projecao` existir
- **THEN** o sistema conclui a operação normalmente retornando `200 OK`

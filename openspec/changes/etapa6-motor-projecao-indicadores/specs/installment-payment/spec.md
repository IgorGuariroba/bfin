## MODIFIED Requirements

### Requirement: Invalidação de projeção após pagamento
O sistema SHALL marcar projeções como `invalidada` de forma síncrona após confirmar pagamento, cobrindo tanto o mês de `data_pagamento` quanto o mês de `data_vencimento` — invalidando a partir do menor deles e todos os meses posteriores. Se a tabela `projecao` ainda não existir, o erro PostgreSQL `42P01` MUST ser tratado como no-op. Após a invalidação síncrona e o retorno da resposta HTTP com sucesso, o sistema MUST emitir `projecao:recalcular` via `eventBus` com payload `{ contaId, mesInicial }`, onde `mesInicial` é o menor mês entre `data_pagamento` e `data_vencimento` em formato `YYYY-MM`.

#### Scenario: Pagamento no mesmo mês do vencimento
- **WHEN** uma parcela com `data_vencimento: "2024-02-15"` recebe pagamento em `"2024-02-20"`
- **THEN** o sistema invalida projeções com `mes >= '2024-02'` antes de responder `200`

#### Scenario: Pagamento antecipado em mês anterior
- **WHEN** uma parcela com `data_vencimento: "2024-03-15"` recebe pagamento em `"2024-02-28"`
- **THEN** o sistema invalida projeções com `mes >= '2024-02'` (menor dos dois meses)

#### Scenario: Tabela projecao inexistente
- **WHEN** um pagamento é confirmado antes da tabela `projecao` existir
- **THEN** o sistema conclui a operação normalmente retornando `200 OK`

#### Scenario: Emissão de projecao:recalcular após pagamento
- **WHEN** uma parcela com `data_vencimento: "2024-02-15"` é paga em `2024-02-20`
- **THEN** o sistema emite `projecao:recalcular` com `{ contaId, mesInicial: "2024-02" }` após a resposta HTTP

#### Scenario: Emissão com pagamento antecipado
- **WHEN** uma parcela com `data_vencimento: "2024-03-15"` é paga em `"2024-02-28"`
- **THEN** o sistema emite `projecao:recalcular` com `mesInicial: "2024-02"` (menor mês entre `data_pagamento` e `data_vencimento`)

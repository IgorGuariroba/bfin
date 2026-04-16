# recurrence-logic Specification

## Purpose

Define a capability de recorrência de movimentações: representação em banco (`recorrente` + `data_fim`), regras de cancelamento e replicação nos meses aplicáveis, para consumo pelo motor de projeção. Uma movimentação recorrente é armazenada como um único registro cuja regra determina em quais meses ela deve ser projetada.

## Requirements

### Requirement: Representação de recorrência no banco
O sistema SHALL armazenar movimentações recorrentes como um único registro, utilizando os campos `recorrente` (BOOLEAN) e `data_fim` (DATE opcional).

#### Scenario: Recorrência indefinida
- **WHEN** uma movimentação é criada com `recorrente: true` e `data_fim: null`
- **THEN** o sistema persiste o registro indicando recorrência sem data limite

#### Scenario: Recorrência com data limite
- **WHEN** uma movimentação é criada com `recorrente: true` e `data_fim: "2025-12-31"`
- **THEN** o sistema persiste o registro indicando recorrência até o mês de dezembro de 2025 (inclusive)

#### Scenario: Movimentação não recorrente
- **WHEN** uma movimentação é criada com `recorrente: false`
- **THEN** o sistema persiste o registro com `recorrente = false` e `data_fim = null`

### Requirement: Cancelamento de recorrência
O sistema SHALL permitir o cancelamento explícito de uma recorrência, interrompendo sua replicação a partir do mês seguinte ao cancelamento, sem alterar meses anteriores já projetados.

#### Scenario: Cancelamento bem-sucedido
- **WHEN** o usuário atualiza uma movimentação recorrente para `recorrente: false`
- **THEN** o sistema define `recorrente = false` e `data_fim = null`, preservando o histórico de meses anteriores

### Requirement: Regras de replicação para projeção
O sistema SHALL replicar movimentações recorrentes nos meses aplicáveis de acordo com as regras de recorrência, para consumo futuro pelo motor de projeção.

#### Scenario: Replicação mensal indefinida
- **WHEN** o motor de projeção processa uma movimentação com `recorrente: true` e `data_fim: null`
- **THEN** a movimentação SHALL ser considerada em todos os meses subsequentes, mantendo o mesmo dia de vencimento (ou último dia do mês se o dia não existir)

#### Scenario: Replicação com data limite
- **WHEN** o motor de projeção processa uma movimentação com `recorrente: true` e `data_fim: "2025-06-30"`
- **THEN** a movimentação SHALL ser considerada até o mês de junho de 2025 (inclusive) e ignorada a partir de julho de 2025

#### Scenario: Interrupção após cancelamento
- **WHEN** o motor de projeção processa uma movimentação com `recorrente: false`
- **THEN** a movimentação SHALL ser considerada apenas no mês original e ignorada nos meses seguintes

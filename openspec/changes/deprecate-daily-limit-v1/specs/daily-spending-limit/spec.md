## MODIFIED Requirements

### Requirement: Endpoint GET /contas/{contaId}/limite-diario

> **DEPRECATED (sunset `2026-07-23T00:00:00Z`):** este endpoint está marcado para remoção. Consumidores MUST migrar para `GET /contas/{contaId}/limite-diario-v2`. Durante o sunset, o comportamento funcional permanece inalterado; o sistema apenas sinaliza a deprecação via headers.

O sistema SHALL expor `GET /contas/{contaId}/limite-diario`, protegido por `Auth Guard` e pelo middleware de autorização por conta. `owner` e `viewer` MUST conseguir consultar o limite. Usuários sem vínculo com a conta MUST receber `403 INSUFFICIENT_PERMISSIONS`. Conta inexistente MUST retornar `404 RESOURCE_NOT_FOUND`. A rota MUST sempre calcular o valor em tempo real — não usar cache da tabela `projecao`.

Enquanto deprecada, a rota MUST incluir os seguintes headers em toda resposta de sucesso:
- `Deprecation: true` (RFC 9745)
- `Sunset: 2026-07-23T00:00:00Z` (RFC 8594, formato HTTP-date)
- `Link: </contas/{contaId}/limite-diario-v2>; rel="successor-version"` (RFC 8288)

#### Scenario: Owner consulta limite

- **WHEN** um `owner` envia `GET /contas/{contaId}/limite-diario`
- **THEN** o sistema retorna `200 OK` com `contaId`, `mes_referencia`, `saldo_disponivel`, `despesas_fixas_pendentes`, `dias_restantes`, `limite_diario` e `calculado_em`

#### Scenario: Viewer consulta limite

- **WHEN** um `viewer` envia `GET /contas/{contaId}/limite-diario`
- **THEN** o sistema retorna `200 OK` com o mesmo payload

#### Scenario: Usuário sem vínculo

- **WHEN** um usuário autenticado que não é membro da conta solicita o limite
- **THEN** o sistema retorna `403 Forbidden`

#### Scenario: Resposta inclui headers de deprecação

- **WHEN** um `owner` ou `viewer` envia `GET /contas/{contaId}/limite-diario` e recebe `200 OK`
- **THEN** a resposta inclui `Deprecation: true`, `Sunset: 2026-07-23T00:00:00Z` e `Link: </contas/{contaId}/limite-diario-v2>; rel="successor-version"`

### Requirement: Cálculo do saldo disponível

O sistema MUST preservar o cálculo v1 descrito abaixo durante o sunset para compatibilidade com consumidores que ainda usam a rota `/limite-diario`. **DEPRECATED (sunset `2026-07-23T00:00:00Z`):** este cálculo permanece apenas como suporte à rota v1; a v2 (`/limite-diario-v2`) usa regra diferente e não depende deste requirement.

O sistema MUST calcular `saldo_disponivel = saldo_conta - despesas_fixas_pendentes_mes` onde:
- `saldo_conta` = saldo real atual da conta, equivalente a `saldo_inicial + Σ(valor das movimentações `receita` com `data <= hoje`) − Σ(valor das movimentações `despesa` com `data <= hoje`)`;
- `despesas_fixas_pendentes_mes` = soma de (a) movimentações com `recorrente = true`, tipo `despesa` e data replicada dentro do mês corrente que ainda não ocorreu (data > hoje) + (b) parcelas de dívidas com `data_vencimento` dentro do mês corrente e `data_pagamento IS NULL`.

`mes_referencia` MUST ser o mês corrente em formato `YYYY-MM` no fuso horário do servidor (UTC).

#### Scenario: Composição do saldo disponível

- **WHEN** `saldo_conta = 5000` e `despesas_fixas_pendentes_mes = 1800`
- **THEN** `saldo_disponivel = 3200`

#### Scenario: Parcelas do mês corrente contam como pendentes

- **WHEN** existe parcela com `data_vencimento` no mês corrente e `data_pagamento IS NULL`
- **THEN** o `valor` dessa parcela é incluído em `despesas_fixas_pendentes_mes`

#### Scenario: Parcelas pagas não contam

- **WHEN** uma parcela do mês corrente possui `data_pagamento` preenchido
- **THEN** ela não é somada em `despesas_fixas_pendentes_mes`

#### Scenario: Recorrentes já ocorridas no mês não contam

- **WHEN** uma despesa recorrente com `data` original `05` do mês, hoje é dia `20` do mês e já foi debitada
- **THEN** ela não é somada em `despesas_fixas_pendentes_mes` (já consta em `saldo_conta`)

### Requirement: Cálculo do limite diário

O sistema MUST preservar a divisão por `dias_restantes_no_mes` durante o sunset. **DEPRECATED (sunset `2026-07-23T00:00:00Z`):** esta regra permanece apenas para a v1; a v2 usa `max(0, saldo_atual) / 30` com janela móvel de 30 dias.

O sistema MUST calcular `limite_diario = saldo_disponivel / dias_restantes_no_mes`, onde `dias_restantes_no_mes = (último_dia_do_mes - hoje) + 1` (incluindo hoje). O resultado MUST ser arredondado para 2 casas decimais com `HALF_EVEN`. Se `dias_restantes_no_mes == 0`, o sistema MUST retornar `limite_diario = saldo_disponivel` (ou 0 se negativo não for permitido — ver abaixo). Se `saldo_disponivel <= 0`, o `limite_diario` MUST ser retornado como `0.00`, sinalizando que não há margem para gastos adicionais.

#### Scenario: Cálculo padrão

- **WHEN** `saldo_disponivel = 3200` e `dias_restantes = 16`
- **THEN** `limite_diario = 200.00`

#### Scenario: Saldo disponível negativo

- **WHEN** `saldo_disponivel = -500` e `dias_restantes = 10`
- **THEN** `limite_diario = 0.00`

#### Scenario: Último dia do mês

- **WHEN** hoje é o último dia do mês
- **THEN** `dias_restantes = 1` e `limite_diario = saldo_disponivel / 1`

### Requirement: Independência da meta de reserva

O sistema MUST continuar garantindo a independência descrita abaixo durante o sunset. **DEPRECATED (sunset `2026-07-23T00:00:00Z`):** requirement mantido para a v1; a v2 possui requirement próprio e mais amplo (`Independência de reserva e projeção (v2)`).

O sistema MUST garantir que `porcentagem_reserva` da meta NUNCA entre no cálculo de `limite_diario`. A rota MUST produzir o mesmo resultado para uma conta com e sem meta, dadas as mesmas movimentações e parcelas.

#### Scenario: Meta presente não altera limite

- **WHEN** uma conta possui meta de 30% e outra conta idêntica em movimentações não possui meta
- **THEN** ambas retornam o mesmo `limite_diario`

## ADDED Requirements

### Requirement: Deprecação das tools MCP v1

O sistema MUST marcar as tools MCP `daily-limit_get` e `daily-limit_set` como deprecated, prefixando o campo `description` com `[DEPRECATED — use <substituto>; sunset 2026-07-23T00:00:00Z]`:
- `daily-limit_get`: substituto indicado é `daily-limit_v2_get`.
- `daily-limit_set`: substitutos indicados são `goals_create` e `goals_update` (a operação real é `upsertMeta`, e `porcentagem_reserva` nunca afetou o cálculo de limite diário).

O contrato (schema de entrada, saída, `requiredScope`, `minRole`) de ambas as tools MUST permanecer inalterado até a data de sunset. A remoção efetiva das tools será feita em change futura, posterior à data de sunset.

#### Scenario: description da tool daily-limit_get sinaliza deprecação

- **WHEN** um cliente MCP lista as tools disponíveis
- **THEN** a `description` de `daily-limit_get` começa com `[DEPRECATED — use daily-limit_v2_get; sunset 2026-07-23T00:00:00Z]`

#### Scenario: description da tool daily-limit_set sinaliza deprecação

- **WHEN** um cliente MCP lista as tools disponíveis
- **THEN** a `description` de `daily-limit_set` começa com `[DEPRECATED — use goals_create/goals_update; sunset 2026-07-23T00:00:00Z]`

#### Scenario: Execução das tools deprecadas continua funcional

- **WHEN** um cliente MCP autorizado invoca `daily-limit_get` ou `daily-limit_set` durante o sunset
- **THEN** a tool executa normalmente, retornando o mesmo payload e efeitos colaterais de antes da deprecação

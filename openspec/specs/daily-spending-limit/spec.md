# daily-spending-limit Specification

## Purpose

Define a capability de cálculo do limite diário de gastos: endpoint de consulta em tempo real que calcula quanto o usuário pode gastar por dia no restante do mês, considerando saldo disponível, despesas fixas pendentes e dias restantes. O cálculo é independente da meta de reserva.

## Requirements

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

### Requirement: Endpoint GET /contas/{contaId}/limite-diario-v2

O sistema SHALL expor `GET /contas/{contaId}/limite-diario-v2`, protegido por `Auth Guard` e pelo middleware de autorização por conta. `owner` e `viewer` MUST conseguir consultar o limite. Usuários sem vínculo com a conta MUST receber `403 INSUFFICIENT_PERMISSIONS`. Conta inexistente MUST retornar `404 RESOURCE_NOT_FOUND`. A rota MUST sempre calcular o valor em tempo real — não usar cache nem tabela `projecao`.

O payload de resposta MUST conter exatamente os campos `contaId`, `janela_inicio` (ISO 8601 UTC), `janela_fim` (ISO 8601 UTC), `horizonte_dias` (inteiro, sempre `30`), `saldo_atual` (string decimal com 2 casas), `limite_diario` (string decimal com 2 casas) e `calculado_em` (ISO 8601 UTC).

#### Scenario: Owner consulta limite v2

- **WHEN** um `owner` envia `GET /contas/{contaId}/limite-diario-v2`
- **THEN** o sistema retorna `200 OK` com `contaId`, `janela_inicio`, `janela_fim`, `horizonte_dias`, `saldo_atual`, `limite_diario` e `calculado_em`

#### Scenario: Viewer consulta limite v2

- **WHEN** um `viewer` envia `GET /contas/{contaId}/limite-diario-v2`
- **THEN** o sistema retorna `200 OK` com o mesmo payload

#### Scenario: Usuário sem vínculo

- **WHEN** um usuário autenticado que não é membro da conta envia `GET /contas/{contaId}/limite-diario-v2`
- **THEN** o sistema retorna `403 Forbidden` com `code: "INSUFFICIENT_PERMISSIONS"`

#### Scenario: Conta inexistente

- **WHEN** um `owner` solicita `GET /contas/{contaId}/limite-diario-v2` com `contaId` que não existe
- **THEN** o sistema retorna `404 Not Found` com `code: "RESOURCE_NOT_FOUND"`

### Requirement: MCP tool daily-limit_v2_get

O sistema SHALL expor a tool MCP `daily-limit_v2_get` com `requiredScope: "daily-limit:read"` e `minRole: "viewer"`. A tool MUST aceitar `contaId` (UUID obrigatório) e `hoje` (ISO 8601 datetime opcional, usado em testes). A tool MUST retornar o mesmo payload que a rota HTTP v2, com os mesmos campos e formatos. A tool MUST reutilizar o serviço de cálculo v2 — não duplicar lógica.

#### Scenario: Tool retorna limite v2

- **WHEN** um cliente MCP autorizado chama `daily-limit_v2_get` com `contaId` válido
- **THEN** a tool retorna `contaId`, `janela_inicio`, `janela_fim`, `horizonte_dias`, `saldo_atual`, `limite_diario` e `calculado_em`

#### Scenario: Tool rejeita contaId inválido

- **WHEN** a tool `daily-limit_v2_get` é chamada com `contaId` que não é UUID
- **THEN** a tool rejeita via validação de schema antes de executar o handler

### Requirement: Janela móvel de 30 dias

O sistema MUST definir `janela_inicio = hoje` (UTC, truncado ao instante atual) e `janela_fim = hoje + 30 dias`. `horizonte_dias` MUST ser sempre `30`. A janela MUST ser recalculada a cada consulta com base no `now()` do servidor — não depender do mês calendário nem de configuração persistida.

#### Scenario: Janela independe do mês calendário

- **WHEN** a rota é consultada em `2026-04-28T10:00:00Z`
- **THEN** `janela_inicio = 2026-04-28T10:00:00Z` e `janela_fim = 2026-05-28T10:00:00Z`, sem truncamento no fim do mês

#### Scenario: Consulta no último dia do mês

- **WHEN** a rota é consultada em `2026-04-30T23:59:00Z`
- **THEN** `janela_fim = 2026-05-30T23:59:00Z` e `horizonte_dias = 30`

### Requirement: Cálculo de saldo_atual (v2)

O sistema MUST calcular `saldo_atual = saldo_inicial + Σ receitas(data ≤ hoje) − Σ despesas(data ≤ hoje)`, onde `receitas` e `despesas` são movimentações da conta cujo `tipo_categoria.slug` é `receita` ou `despesa` respectivamente. O cálculo MUST considerar apenas movimentações com `data ≤ hoje` (não considerar receitas futuras, recorrentes futuras, nem projeções).

O cálculo MUST NOT subtrair parcelas de dívida (`parcelasDivida`) nem recorrentes futuras do cálculo de `saldo_atual` — estes continuam sendo responsabilidade do `projection-engine`.

#### Scenario: Soma receitas e despesas realizadas

- **WHEN** `saldo_inicial = 1000`, receitas realizadas até hoje somam `3000` e despesas realizadas até hoje somam `1500`
- **THEN** `saldo_atual = 2500`

#### Scenario: Receitas futuras não contam

- **WHEN** existe uma movimentação de receita com `data` no futuro (`data > hoje`)
- **THEN** essa receita NÃO é somada em `saldo_atual`

#### Scenario: Parcelas de dívida não entram

- **WHEN** existem parcelas de dívida pendentes dentro ou fora da janela
- **THEN** `saldo_atual` ignora essas parcelas

#### Scenario: Recorrentes futuras não entram

- **WHEN** existe uma movimentação recorrente com `data > hoje`
- **THEN** essa recorrência NÃO é somada nem subtraída de `saldo_atual`

### Requirement: Cálculo de limite_diario (v2)

O sistema MUST calcular `limite_diario = max(0, saldo_atual) / 30`, arredondado em centavos com `HALF_EVEN` (bankers' rounding) reutilizando o helper `roundCentsHalfEven` de `src/lib/money.ts`. O resultado MUST ser serializado como string decimal com 2 casas. Se `saldo_atual ≤ 0`, `limite_diario` MUST ser `"0.00"`.

#### Scenario: Cálculo padrão

- **WHEN** `saldo_atual = 3000.00`
- **THEN** `limite_diario = "100.00"`

#### Scenario: Saldo zero

- **WHEN** `saldo_atual = 0.00`
- **THEN** `limite_diario = "0.00"`

#### Scenario: Saldo negativo

- **WHEN** `saldo_atual = -150.00`
- **THEN** `limite_diario = "0.00"`

#### Scenario: Arredondamento HALF_EVEN

- **WHEN** `saldo_atual = 100.00` (valor que gera dízima ao dividir por 30)
- **THEN** `limite_diario` é arredondado via `roundCentsHalfEven(10000n, 30n)` em centavos

### Requirement: Independência de reserva e projeção (v2)

O sistema MUST garantir que o cálculo v2 NUNCA consulte `metas.porcentagem_reserva`, a tabela `projecao`, recorrentes futuras (`movimentacoes` com `data > hoje`) ou parcelas (`parcelasDivida`). A rota/tool v2 MUST produzir o mesmo resultado para uma conta com e sem meta, com e sem dívidas, com e sem recorrentes futuras, dado o mesmo conjunto de movimentações realizadas.

#### Scenario: Meta não altera limite v2

- **WHEN** duas contas têm as mesmas movimentações realizadas, mas uma possui `meta.porcentagem_reserva = 30` e a outra não possui meta
- **THEN** ambas retornam o mesmo `limite_diario`

#### Scenario: Dívidas não alteram limite v2

- **WHEN** duas contas têm as mesmas movimentações realizadas, mas uma possui parcelas pendentes e a outra não
- **THEN** ambas retornam o mesmo `limite_diario`

## ADDED Requirements

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

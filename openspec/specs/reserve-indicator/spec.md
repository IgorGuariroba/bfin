# reserve-indicator Specification

## Purpose

Define a capability do indicador de reserva de emergência: cálculo da reserva ideal com base na meta e receitas brutas, cálculo da sobra real, atribuição de cor (verde/amarelo/vermelho) ao indicador diário e mensal, e desabilitação automática quando a conta não possui meta ativa.

## Requirements

### Requirement: Cálculo da reserva ideal

Quando a conta possui meta ativa, o motor MUST calcular, para cada mês projetado, `reserva_ideal = receitas_brutas_mes × (porcentagem_reserva / 100)`, onde `receitas_brutas_mes` é a soma dos `valor` de todas as movimentações do tipo `receita` projetadas naquele mês (incluindo recorrentes replicadas). O valor MUST ser arredondado para 2 casas decimais usando arredondamento bancário (`HALF_EVEN`).

#### Scenario: Cálculo simples
- **WHEN** `receitas_brutas_mes = 5000.00` e `porcentagem_reserva = 20`
- **THEN** `reserva_ideal = 1000.00`

#### Scenario: Sem receitas no mês
- **WHEN** um mês tem `receitas_brutas_mes = 0` e existe meta definida
- **THEN** `reserva_ideal = 0.00` e o indicador opera normalmente com base em `sobra_real`

### Requirement: Cálculo da sobra real

O motor MUST calcular, para cada mês projetado, `sobra_real = saldo_projetado_fim_mes - total_dividas_pendentes_fim_mes`. Ambos os operandos MUST ser extraídos do último dia do mês. A sobra MUST ser usada como base de comparação com `reserva_ideal`.

#### Scenario: Sobra positiva com passivo
- **WHEN** `saldo_projetado_fim_mes = 4000` e `total_dividas_pendentes_fim_mes = 1000`
- **THEN** `sobra_real = 3000`

#### Scenario: Sobra negativa
- **WHEN** `saldo_projetado_fim_mes = 100` e `total_dividas_pendentes_fim_mes = 500`
- **THEN** `sobra_real = -400`

### Requirement: Cor do indicador de reserva

O motor MUST atribuir ao campo `indicador_reserva` de cada dia um dos valores `"verde"`, `"amarelo"`, `"vermelho"` ou `null` conforme:
- `"verde"` quando `sobra_real_do_dia >= reserva_ideal_do_mes` e existe meta;
- `"amarelo"` quando `0 < sobra_real_do_dia < reserva_ideal_do_mes` e existe meta;
- `"vermelho"` quando `sobra_real_do_dia <= 0` e existe meta;
- `null` quando a conta não possui meta.

O mesmo esquema MUST ser aplicado ao campo `indicador_reserva_final` do resumo, usando `sobra_real_fim_mes`.

#### Scenario: Indicador verde no fim do mês
- **WHEN** `sobra_real_fim_mes = 1200` e `reserva_ideal = 1000`
- **THEN** `indicador_reserva_final = "verde"` e `reserva_atingida = true`

#### Scenario: Indicador amarelo
- **WHEN** `sobra_real_fim_mes = 500` e `reserva_ideal = 1000`
- **THEN** `indicador_reserva_final = "amarelo"` e `reserva_atingida = false`

#### Scenario: Indicador vermelho com sobra zero
- **WHEN** `sobra_real_fim_mes = 0`
- **THEN** `indicador_reserva_final = "vermelho"`

#### Scenario: Indicador vermelho com sobra negativa
- **WHEN** `sobra_real_fim_mes = -200`
- **THEN** `indicador_reserva_final = "vermelho"`

### Requirement: Indicador desabilitado sem meta

Quando a conta não possui meta ativa, o motor MUST definir `meta_reserva = null`, `indicador_reserva = null` em cada dia, e `reserva_ideal = null`, `reserva_atingida = null`, `indicador_reserva_final = null` no resumo. O motor MUST calcular normalmente `saldo_projetado`, `saldo_liquido` e `total_dividas_pendentes` — apenas o indicador é desabilitado.

#### Scenario: Sem meta, saldo projetado preservado
- **WHEN** a conta não possui meta e o usuário solicita a projeção
- **THEN** todos os campos do array `projecao` relativos a saldos são preenchidos, mas `indicador_reserva` é `null` em cada entrada

#### Scenario: Resumo sem meta
- **WHEN** a conta não possui meta
- **THEN** `reserva_ideal`, `reserva_atingida` e `indicador_reserva_final` no resumo são `null`

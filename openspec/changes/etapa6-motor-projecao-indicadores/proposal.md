## Why

As Etapas 1–5 entregaram os dados brutos da API (usuários, contas, categorias, movimentações, dívidas e parcelas), porém nenhuma inteligência financeira. Sem motor de projeção, a API é apenas um CRUD — o propósito do produto é justamente responder perguntas sobre o futuro financeiro ("vou fechar o mês no azul?", "estou construindo reserva?", "quanto posso gastar hoje?"). A Etapa 6 fecha o ciclo do MVP entregando o motor de inferência descrito nas seções 5.6, 5.7, 7 e 8 do `plano.md`: projeção dia-a-dia com cascata lazy, cache persistido no PostgreSQL, invalidação em cascata orientada a eventos, Indicador de Reserva (verde/amarelo/vermelho), Meta de Reserva de Emergência e Limite Diário de Gasto.

## What Changes

- **Tabelas novas**: `projecao` (cache mensal por conta, com `status` atualizada/invalidada e `recalculado_em`) e `meta` (porcentagem de reserva por conta, 1:1).
- **Rotas novas**:
  - `GET /projecao?contaId=...&mes=YYYY-MM` — retorna projeção diária com cache lazy + cascata.
  - `POST /metas` — define/atualiza a porcentagem de reserva de emergência de uma conta (`owner`).
  - `GET /contas/{contaId}/limite-diario` — limite diário de gasto calculado sobre saldo real e despesas fixas pendentes.
- **Motor de projeção dia-a-dia** (seção 7): cálculo de `saldo_projetado`, `total_dividas_pendentes` e `saldo_liquido` para cada dia do mês, incluindo replicação de movimentações recorrentes com respeito a `data_fim`, e aplicação de parcelas somente a partir do `data_vencimento`.
- **Cascata lazy com cache**: ao solicitar projeção de um mês, o sistema usa a projeção persistida quando `status='atualizada'`; caso contrário recalcula, descendo recursivamente até encontrar um mês persistido válido ou usar `saldo_inicial` da conta. Profundidade máxima de 12 meses (`422 CASCADE_DEPTH_EXCEEDED` acima disso).
- **Invalidação em cascata**: quando uma mutação afeta um mês `M`, o sistema atualiza `status='invalidada'` para `(conta_id = X AND mes >= M)` antes de responder (já coberto nas etapas 4 e 5 como no-op até a tabela existir) — esta etapa torna a tabela real.
- **Sistema de eventos (EventEmitter)** (seção 8): após a invalidação síncrona, as rotas mutadoras emitem `projecao:recalcular` via EventEmitter nativo do Node. Um listener in-process executa o recálculo assíncrono e grava `status='atualizada'` + `recalculado_em`. In-process é consciente das limitações de PM2 cluster mode (documentadas no design).
- **Indicador de Reserva** (seção 5.6 + 7): campo `indicador_reserva` com valores `verde`, `amarelo`, `vermelho` ou `null` (quando a conta não tem meta). Presente em cada dia da projeção e no resumo mensal.
- **Meta de Reserva de Emergência** (seção 5.6): `porcentagem_reserva` de 0–100 por conta, decisão coletiva (1:1). Sem trava de viabilidade — o indicador reflete a realidade.
- **Limite Diário de Gasto** (seção 5.7): `limite_diario = (saldo_conta - despesas_fixas_pendentes_mes) / dias_restantes_no_mes`. Independente da meta de reserva.
- **Emissão de eventos a partir das capabilities existentes**: as rotas de movimentações, dívidas, parcelas e atualização de conta (`saldo_inicial`) passam a emitir `projecao:recalcular` após a invalidação síncrona. Isso é um incremento não-breaking sobre os specs existentes.

## Capabilities

### New Capabilities

- `projection-engine`: motor de projeção dia-a-dia com cascata lazy, persistência em PostgreSQL (tabela `projecao`), invalidação em cascata, EventEmitter para recálculo assíncrono, e rota `GET /projecao`. Define o schema de resposta (array diário + resumo) e o tratamento de ausência de meta.
- `emergency-reserve-goal`: CRUD de meta de reserva (rota `POST /metas`), regras de validação (0–100), unicidade 1:1 por conta, sem trava de viabilidade.
- `reserve-indicator`: lógica do indicador verde/amarelo/vermelho a partir de `reserva_ideal` e `sobra_real`; emissão do valor `null` quando não há meta definida. Consumida pela projeção.
- `daily-spending-limit`: rota `GET /contas/{contaId}/limite-diario` com fórmula baseada em saldo real e despesas fixas pendentes (recorrentes do mês + parcelas de dívidas com vencimento no mês e não pagas). Independente de meta.

### Modified Capabilities

- `transaction-management`: adiciona requisito de emitir `projecao:recalcular` após a invalidação síncrona já especificada. Sem alteração de contrato HTTP.
- `installment-payment`: adiciona requisito de emitir `projecao:recalcular` após a invalidação síncrona. Sem alteração de contrato HTTP.
- `debt-management`: adiciona requisito de emitir `projecao:recalcular` após a invalidação síncrona. Sem alteração de contrato HTTP.
- `account-management`: `PATCH /contas/{contaId}` que altere `saldo_inicial` passa a (1) invalidar todas as projeções da conta (`mes >= primeiro_mes_persistido`) e (2) emitir `projecao:recalcular` com `mesInicial = primeiro mês persistido da conta` (ou mês corrente se nenhum existir).

## Impact

- **Banco de dados**: novas migrations Drizzle para `projecao` e `meta`. Nenhuma alteração destrutiva em tabelas existentes.
- **Código da aplicação**:
  - Novo módulo `src/services/projection-engine/` com cálculo dia-a-dia, cascata recursiva limitada a 12 meses e persistência.
  - Novo `src/lib/event-bus.ts` com `EventEmitter` singleton e tipagem dos eventos `projecao:recalcular`.
  - `src/services/projection-invalidation.ts` já existe (etapas 4/5) — evolui de no-op para UPDATE real + `emit('projecao:recalcular', ...)`.
  - Novos serviços `goal-service.ts`, `daily-limit-service.ts`, `projection-service.ts`.
  - Novas rotas `src/routes/projections.ts`, `src/routes/goals.ts` e extensão de `accounts.ts` para `/contas/{contaId}/limite-diario`.
- **Observabilidade**: logs estruturados com `requestId`, `contaId` e `mes` em todos os fluxos de cálculo. Pino já está configurado.
- **PM2 cluster mode**: EventEmitter é per-process. Invalidação síncrona no PostgreSQL garante consistência entre processos; o recálculo pode ser duplicado, mas é idempotente (ver design). Nenhuma dependência externa (Redis/BullMQ) é introduzida no MVP.
- **Testes**: suíte integrada `vitest` dentro de `docker-compose.test.yml` (padrão "No Mocks"). Novos testes cobrem motor de projeção, cascata, indicador, meta e limite diário.
- **Coleção `.posting/`**: adicionar requests manuais para as novas rotas.
- **Sem breaking changes** nas capabilities modificadas — apenas adição de comportamento (emissão de evento) após a invalidação já existente.

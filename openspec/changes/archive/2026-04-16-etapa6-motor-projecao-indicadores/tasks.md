## 1. Fundação: schema, event bus e helpers

- [x] 1.1 Adicionar ao `src/db/schema.ts` a tabela `projecao` (UUID PK, `conta_id` FK, `mes` VARCHAR, `dados` JSONB, `status` enum `atualizada|invalidada`, `recalculado_em`, `created_at`, `updated_at`) com índice único em `(conta_id, mes)` e FK `conta_id → conta ON DELETE CASCADE`.
- [x] 1.2 Adicionar ao `src/db/schema.ts` a tabela `meta` (UUID PK, `conta_id` FK UNIQUE, `porcentagem_reserva` DECIMAL(5,2), `created_at`, `updated_at`) com FK `conta_id → conta ON DELETE CASCADE`.
- [x] 1.3 Gerar a migration Drizzle (`npm run db:generate`) e conferir o SQL produzido em `src/db/migrations/`.
- [x] 1.4 Subir o stack (`docker compose up`) e aplicar a migration (`npm run db:migrate`) para validar localmente.
- [x] 1.5 Criar `src/lib/event-bus.ts` exportando um singleton `eventBus` baseado em `EventEmitter`, com API tipada para o evento `projecao:recalcular` (payload `{ contaId: string, mesInicial: string }`).
- [x] 1.6 Criar helper `src/lib/money.ts` com utilitários `toCents(decimal)`, `fromCents(bigint)` e `roundHalfEven(n, scale=2)` para a aritmética monetária (reaproveitar lógica existente no `debt-service` se já houver).
- [x] 1.7 Criar helper `src/lib/month.ts` com utilitários `monthKey(date)` (`YYYY-MM`), `previousMonth(key)`, `lastDayOfMonth(date)`, `daysInMonthRange(startKey, endKey)` usados por motor e rotas.

## 2. Evolução da invalidação síncrona + emissão de eventos

- [x] 2.1 Atualizar `src/services/projection-invalidation.ts` para executar o UPDATE real (`UPDATE projecao SET status='invalidada' WHERE conta_id=$1 AND mes >= $2`) mantendo o tratamento de `42P01` como no-op.
- [x] 2.2 Após a invalidação, emitir `projecao:recalcular` via `eventBus` com o payload `{ contaId, mesInicial }` (onde `mesInicial = monthKey(dataReferencia)`).
- [x] 2.3 Expor helper `invalidateAllProjections(contaId)` (UPDATE sem cláusula de `mes`) para ser chamado por `account-service.updateConta` quando `saldo_inicial` muda.
- [x] 2.4 Atualizar `src/services/account-service.ts` para invocar `invalidateAllProjections` + emitir `projecao:recalcular` quando `saldo_inicial` for alterado. Determinar `mesInicial` como `min(mes)` de `projecao` para a conta (ou `monthKey(now())` se não houver projeção).
- [x] 2.5 Garantir que `transaction-service`, `debt-service` e `installment-payment` continuem chamando `invalidateProjections` nos mesmos pontos já existentes (nenhuma alteração no fluxo, apenas comportamento novo dentro da função).
- [x] 2.6 Ajustar/criar testes de integração em `tests/` que observem o efeito: `status='invalidada'` no banco + evento emitido (pode observar via listener de teste).

## 3. Motor de projeção — cálculo puro

- [x] 3.1 Criar `src/services/projection-engine/calculator.ts` com `calcularMes({ saldoInicial, mes, receitas, despesas, parcelas, meta })` puro (sem I/O) que retorna `{ dias: DiaProjecao[], resumo: ResumoMes }`.
- [x] 3.2 Implementar em `calculator.ts` a expansão de movimentações recorrentes (respeitando `data_fim` e a regra de "último dia do mês quando o dia não existe") compartilhando helper com `debt-service`.
- [x] 3.3 Implementar a soma acumulada dia-a-dia de `saldo_projetado`, `receitas_dia`, `despesas_dia`, `parcelas_pagas_dia`, usando `bigint` em centavos.
- [x] 3.4 Implementar `total_dividas_pendentes[d]` filtrando parcelas com `data_vencimento <= d AND data_pagamento IS NULL`.
- [x] 3.5 Derivar `saldo_liquido[d] = saldo_projetado[d] - total_dividas_pendentes[d]`.
- [x] 3.6 Construir o `resumo` (totais + `saldo_final_projetado`, `saldo_liquido_final`).
- [x] 3.7 Escrever testes unitários de `calculator.ts` cobrindo: (a) mês sem movimentações, (b) recorrentes com e sem `data_fim`, (c) parcelas futuras invisíveis, (d) parcelas vencidas acumulando entre dias, (e) mês com pagamento antecipado.

## 4. Motor de projeção — cascata lazy e persistência

- [x] 4.1 Criar `src/services/projection-engine/persistence.ts` com `readProjecao(contaId, mes)`, `upsertProjecao(contaId, mes, dados, status)` e `getEarliestPersistedMonth(contaId)`.
- [x] 4.2 Criar `src/services/projection-engine/cascade.ts` com `resolveProjecao(contaId, mes, depth=0)` que implementa o algoritmo da seção 7: cache hit (`status='atualizada'`), senão recalcula, descendo recursivamente por `previousMonth(mes)` até encontrar cache válido ou usar `Conta.saldo_inicial`.
- [x] 4.3 Proteger a recursão: se `depth > 12`, lançar erro tipado que a rota converte em `422 CASCADE_DEPTH_EXCEEDED`.
- [x] 4.4 UPSERT em `projecao` (`ON CONFLICT (conta_id, mes) DO UPDATE`) com `status='atualizada'` e `recalculado_em=NOW()` ao final de cada recálculo.
- [x] 4.5 Escrever testes de integração cobrindo: (a) cache hit, (b) recálculo após invalidação, (c) cascata de 2 e 3 níveis, (d) caso base usando `saldo_inicial`, (e) limite de 12 meses atingido.

## 5. Motor de projeção — indicador de reserva

- [x] 5.1 Criar `src/services/projection-engine/reserve-indicator.ts` com funções puras `calcularReservaIdeal(receitasBrutasMes, porcentagem)` e `classificarIndicador(sobraReal, reservaIdeal)` retornando `"verde" | "amarelo" | "vermelho"`.
- [x] 5.2 Integrar no `calculator.ts` o preenchimento de `indicador_reserva` em cada dia e `indicador_reserva_final`, `reserva_ideal`, `reserva_atingida` no resumo, usando `sobra_real` do dia/fim de mês.
- [x] 5.3 Garantir que, sem meta, todos os campos relacionados ao indicador sejam `null` (dia e resumo) enquanto os demais campos de saldo continuam preenchidos.
- [x] 5.4 Escrever testes unitários cobrindo as 3 cores + o caso `null` (sem meta), incluindo transição no último dia do mês.

## 6. Listener do evento + integração com motor

- [x] 6.1 No bootstrap do app (ex.: `src/app.ts` ou plugin dedicado), registrar um listener único para `projecao:recalcular` que chama `resolveProjecao(contaId, mesInicial)` via `setImmediate` e captura exceções com `logger.error`.
- [x] 6.2 Garantir que o listener não duplica inscrição em hot-reload / testes (usar `eventBus.removeAllListeners("projecao:recalcular")` antes de registrar, ou pattern equivalente).
- [x] 6.3 Teste de integração: após `POST /movimentacoes`, aguardar brevemente (`await until(...)`) e verificar que `projecao.status='atualizada'` e `recalculado_em` foi atualizado.

## 7. Rota `GET /projecao`

- [x] 7.1 Criar `src/routes/projections.ts` com schema Zod para query `{ contaId: UUID, mes: string matching /^\\d{4}-\\d{2}$/ }`.
- [x] 7.2 Registrar `GET /projecao` aplicando `auth guard` e middleware de autorização por conta (owner OU viewer).
- [x] 7.3 Invocar `resolveProjecao(contaId, mes)` e montar a resposta conforme a spec (`contaId`, `mes`, `status`, `recalculado_em`, `meta_reserva`, `projecao`, `resumo`).
- [x] 7.4 Traduzir o erro `CASCADE_DEPTH_EXCEEDED` em `422 BUSINESS_RULE_VIOLATION` com `code: "CASCADE_DEPTH_EXCEEDED"`.
- [x] 7.5 Traduzir parâmetros inválidos em `422 BUSINESS_RULE_VIOLATION`.
- [x] 7.6 Registrar a rota em `src/app.ts` (junto com as outras rotas).
- [x] 7.7 Testes de integração: owner lê, viewer lê, estranho recebe 403, mês inválido retorna 422, primeira leitura persiste a linha.

## 8. Meta de reserva — rota `POST /metas`

- [x] 8.1 Criar `src/services/goal-service.ts` com `upsertMeta({ contaId, porcentagemReserva })` retornando `{ id, contaId, porcentagem_reserva, created_at, updated_at, wasCreated }`.
- [x] 8.2 Criar `src/routes/goals.ts` com schema Zod (`porcentagem_reserva` number entre 0 e 100, máximo 2 casas decimais), aplicar `auth guard` + autorização `owner` na conta.
- [x] 8.3 Invocar `upsertMeta`, depois `invalidateAllProjections(contaId)` e emitir `projecao:recalcular` com `mesInicial` = menor `mes` persistido ou `monthKey(now())`.
- [x] 8.4 Retornar `201` quando `wasCreated`, `200` caso contrário.
- [x] 8.5 Registrar a rota em `src/app.ts`.
- [x] 8.6 Testes de integração: cria, atualiza, rejeita `> 100`, `< 0` e não-numéricos; bloqueia `viewer`; confirma que evento foi emitido e `status='invalidada'` afetou todas as projeções da conta.

## 9. Limite diário — rota `GET /contas/{contaId}/limite-diario`

- [x] 9.1 Criar `src/services/daily-limit-service.ts` com `calcularLimiteDiario({ contaId, hoje=new Date() })` que retorna `{ mes_referencia, saldo_disponivel, despesas_fixas_pendentes, dias_restantes, limite_diario, calculado_em }`.
- [x] 9.2 Implementar o cálculo de `saldo_conta` a partir de `saldo_inicial` + soma de receitas/despesas realizadas (movimentações com `data <= hoje`, inclui despesas geradas por pagamentos).
- [x] 9.3 Implementar o cálculo de `despesas_fixas_pendentes_mes` somando (a) movimentações recorrentes do tipo despesa que ainda não ocorreram no mês corrente e (b) parcelas do mês com `data_pagamento IS NULL`.
- [x] 9.4 Aplicar a regra de `limite_diario = saldo_disponivel / dias_restantes`, arredondando `HALF_EVEN`; tratar `saldo_disponivel <= 0` como `limite_diario = 0.00`.
- [x] 9.5 Estender `src/routes/accounts.ts` com `GET /contas/{contaId}/limite-diario` aplicando `auth guard` + autorização por conta (owner ou viewer).
- [x] 9.6 Testes de integração: owner e viewer conseguem, estranho recebe 403, parcela não paga conta, parcela paga não conta, recorrente futura conta, recorrente passada não conta, `saldo_disponivel` negativo retorna 0, último dia do mês retorna `limite = saldo_disponivel`.

## 10. Observabilidade e testes end-to-end

- [x] 10.1 Adicionar logs estruturados Pino em cada ponto-chave do motor: início do recálculo, cascata (níveis percorridos), UPSERT, emissão do evento, erro no listener (`requestId`, `contaId`, `mes`).
- [x] 10.2 Verificar que `requestId` continua propagando em todas as rotas novas (reaproveita o plugin já existente).
- [x] 10.3 Criar teste end-to-end simulando o ciclo completo: cria conta → define meta → cria receitas/despesas/recorrentes → cria dívida com parcelas → paga uma parcela → solicita projeção de 3 meses consecutivos → confere cores, saldos e limite diário.
- [x] 10.4 Adicionar casos negativos: altera `saldo_inicial` e confirma que a projeção muda; deleta dívida sem parcelas pagas e confirma que a projeção volta ao estado anterior.
- [x] 10.5 Rodar `npm run test` e garantir que a suíte inteira passa sem regressão.

## 11. Coleção manual `.posting/` e checklist final

- [x] 11.1 Adicionar requests na coleção `.posting/` para `POST /metas`, `GET /projecao`, `GET /contas/{id}/limite-diario`.
- [x] 11.2 Atualizar (se houver) variáveis/ambientes da coleção para expor `contaId` compartilhado entre os requests novos.
- [x] 11.3 Executar manualmente o fluxo da coleção contra o docker local e registrar evidência no PR (pode ser prints ou log resumido).
- [x] 11.4 Rodar `openspec validate etapa6-motor-projecao-indicadores --strict` e confirmar ausência de erros.
- [x] 11.5 Abrir PR vinculando `proposal.md`, `design.md`, specs e cobertura de testes.

## 1. Schema e migration

- [x] 1.1 Adicionar `dividas` em `src/db/schema.ts` (colunas: `id`, `contaId`, `usuarioId`, `categoriaId`, `descricao`, `valorTotal`, `totalParcelas`, `valorParcela`, `dataInicio`, `createdAt`, `updatedAt`) com FKs para `contas`, `usuarios`, `categorias`
- [x] 1.2 Adicionar `parcelasDivida` em `src/db/schema.ts` (colunas: `id`, `dividaId`, `numeroParcela`, `valor`, `dataVencimento`, `dataPagamento`, `createdAt`, `updatedAt`) com FK `ON DELETE CASCADE` para `dividas` e UNIQUE(`dividaId`, `numeroParcela`)
- [x] 1.3 Adicionar constraint FK `movimentacoes.parcela_divida_id → parcelas_divida(id) ON DELETE SET NULL` no schema
- [x] 1.4 Gerar migration via `docker compose exec api npm run db:generate` e revisar SQL gerado (tabelas novas + ALTER para a FK)
- [x] 1.5 Aplicar migration no ambiente de dev via `docker compose exec api npm run db:migrate` e validar que `\d dividas`, `\d parcelas_divida`, `\d movimentacoes` refletem o esperado

## 2. Erros e helpers compartilhados

- [x] 2.1 Adicionar `AlreadyPaidError` (422, `ALREADY_PAID`) e `DebtHasPaymentsError` (422, `DEBT_HAS_PAYMENTS`) em `src/lib/errors.ts`
- [x] 2.2 Extrair `invalidateProjections` para `src/services/projection-invalidation.ts` e ajustar `transaction-service.ts` para importar de lá (sem alterar comportamento)

## 3. Service de dívidas

- [x] 3.1 Criar `src/services/debt-service.ts` com tipos `CreateDebtInput`, `DebtFilters`, `PaginatedDebts`, `ConfirmPaymentInput`
- [x] 3.2 Implementar `validateCategoriaDivida(categoriaId)` que garante que a categoria existe e tem `tipo_categorias.slug = 'divida'`
- [x] 3.3 Implementar utilitário puro `generateInstallments(valorTotal, totalParcelas, dataInicio)` usando cálculo em centavos e `date-fns.addMonths`, retornando array `{ numero, valor, dataVencimento }` cujo somatório é exatamente `valorTotal`
- [x] 3.4 Implementar `createDebt(input, usuarioId)` em transação Drizzle: valida categoria, gera parcelas via 3.3, persiste `dividas` + N `parcelas_divida`, chama `invalidateProjections(contaId, dataInicio)`
- [x] 3.5 Implementar `findDebtById(id)` retornando dívida com parcelas aninhadas (ordenadas por `numero_parcela`)
- [x] 3.6 Implementar `findDebtsByAccount(filters)` com paginação, filtro `status` via `HAVING COUNT(... WHERE data_pagamento IS NULL) = 0` e inclusão de `total_parcelas`, `parcelas_pagas`, `parcelas_pendentes` no resultado
- [x] 3.7 Implementar `deleteDebt(id)`: verifica existência, checa se existe parcela paga (`data_pagamento IS NOT NULL`) lançando `DebtHasPaymentsError`, senão `DELETE FROM dividas` (cascade remove parcelas) e invalida projeções a partir de `data_inicio`
- [x] 3.8 Implementar `confirmInstallmentPayment(dividaId, parcelaId, input, usuarioId)` em transação com `SELECT ... FOR UPDATE` na parcela; valida existência, rejeita parcela já paga com `AlreadyPaidError`; atualiza `data_pagamento`; insere `movimentacoes` vinculada via `parcela_divida_id`; invalida projeções a partir de `min(data_pagamento, data_vencimento)`; retorna `{ parcela, movimentacao_gerada }`

## 4. Rotas HTTP

- [x] 4.1 Criar `src/routes/debts.ts` com plugin Fastify exportando `debtRoutes`
- [x] 4.2 Implementar `POST /dividas` com `preHandler: requireAccountRole({ minRole: "owner" })` e payload conforme `plano.md §5.5`
- [x] 4.3 Implementar `GET /dividas` com autorização via `extractContaId` do query param e suporte a `page`, `limit`, `status`
- [x] 4.4 Implementar `DELETE /dividas/:dividaId` com `preHandler` que carrega a dívida e reutiliza `requireAccountRole("owner")` (usando o `contaId` da dívida)
- [x] 4.5 Implementar `PATCH /dividas/:dividaId/parcelas/:parcelaId/pagamento` com o mesmo padrão de autorização por `contaId` derivado da dívida
- [x] 4.6 Registrar `debtRoutes` em `src/app.ts` ao lado de `transactionRoutes`

## 5. Testes de integração

- [x] 5.1 Criar `tests/debts.test.ts` com bootstrap reutilizando helpers existentes (factories de usuário, conta e categoria `divida`)
- [x] 5.2 Testes `POST /dividas`: sucesso com divisão exata, sucesso com resíduo (1000/3), rejeição de categoria do tipo errado, rejeição de `valor_total <= 0`, rejeição de `total_parcelas < 1`, `403` para viewer, caso `data_inicio: "2024-01-31"` gerando vencimentos em fim-de-mês
- [x] 5.3 Testes `GET /dividas`: listagem com paginação, filtro `status=pendente`, filtro `status=quitada`, `422` sem `contaId`, `403` para usuário sem associação
- [x] 5.4 Testes `DELETE /dividas/:id`: sucesso quando nenhuma parcela paga, `422 DEBT_HAS_PAYMENTS` com parcela paga, `404` para ID inexistente, `403` para viewer, verificação de cascade delete das parcelas
- [x] 5.5 Testes `PATCH .../pagamento`: sucesso gerando movimentação vinculada, `422 ALREADY_PAID` em parcela já paga, pagamento antecipado (`data_pagamento < data_vencimento`), `404` para IDs inexistentes, `403` para viewer, verificação que `movimentacao_gerada` retorna campos corretos e `parcela_divida_id` está populada
- [x] 5.6 Atualizar `tests/transactions.test.ts` adicionando cenário que confirma pagamento → tenta `DELETE /movimentacoes/{id}` da movimentação gerada → recebe `422 SYSTEM_GENERATED_RESOURCE`
- [x] 5.7 Teste de invalidação de projeção: inserir manualmente uma linha em `projecao(conta_id, mes, dados, status)` com `mes = '2024-02'` e `status = 'atualizada'`, criar dívida com `data_inicio: "2024-02-10"`, verificar que a linha ficou `status = 'invalidada'`

## 6. Validação final e documentação

- [x] 6.1 Rodar `docker compose exec api npm run test` garantindo que a suíte inteira passa (inclui a regressão de `transactions.test.ts`)
- [x] 6.2 Rodar `docker compose exec api npm run lint` e `npm run typecheck`
- [ ] 6.3 Adicionar requests manuais à coleção `.posting/` cobrindo: criar dívida, listar dívidas, confirmar pagamento de parcela, tentar deletar dívida com parcela paga, deletar dívida sem parcelas pagas
- [ ] 6.4 Executar skill `run-manual-tests` para validar o fluxo fim-a-fim com token real

## 1. Schema do Banco

- [x] 1.1 Adicionar tabela `movimentacoes` ao `src/db/schema.ts` com campos `id`, `conta_id`, `usuario_id`, `categoria_id`, `descricao`, `valor`, `data`, `recorrente`, `data_fim`, `created_at`, `updated_at`
- [x] 1.2 Criar migration do Drizzle para a nova tabela
- [x] 1.3 Executar `npm run db:migrate` no container para aplicar a migration

## 2. Service Layer

- [x] 2.1 Criar `src/services/transaction-service.ts` com função `createTransaction`
- [x] 2.2 Implementar validação de tipo da movimentação vs. tipo da categoria em `createTransaction`
- [x] 2.3 Implementar `updateTransaction` com suporte a cancelamento de recorrência (`recorrente: false` limpa `data_fim`)
- [x] 2.4 Implementar `deleteTransaction` chamando `isSystemGenerated(movimentacaoId)` antes de remover; nesta etapa a função retorna sempre `false` (no-op, a detecção real é ligada na Etapa 5)
- [x] 2.5 Implementar `findTransactionsByAccount` com filtros (`data_inicio`, `data_fim`, `tipo`, `categoriaId`, `busca`) e paginação
- [x] 2.6 Implementar `invalidateProjections(contaId, mesInicial)` executando `UPDATE projecao SET status = 'invalidada' WHERE conta_id = $1 AND mes >= $2`; envolver em `try/catch` que engole apenas o erro `42P01` (undefined_table) até a Etapa 6 criar a tabela

## 3. Rotas da API

- [x] 3.1 Criar `src/routes/transactions.ts` com rotas `POST`, `GET`, `PUT`, `DELETE /movimentacoes`
- [x] 3.2 Aplicar `requireAccountRole({ minRole: "owner" })` em `POST`, `PUT`, `DELETE`
- [x] 3.3 Garantir que `GET /movimentacoes` aceite `contaId` obrigatório e retorne `400` se ausente
- [x] 3.4 Garantir que `GET /movimentacoes` seja acessível a `owner` e `viewer`

## 4. Integração com Aplicação

- [x] 4.1 Registrar `transactionRoutes` no `src/app.ts`
- [x] 4.2 Validar que a aplicação inicia sem erros (`docker compose up`)

## 5. Testes

- [x] 5.1 Escrever testes de integração para criação de movimentação (sucesso e validações de negócio)
- [x] 5.2 Escrever testes de integração para atualização e cancelamento de recorrência
- [x] 5.3 Escrever testes de integração para deleção e permissões (`viewer` bloqueado)
- [x] 5.4 Escrever testes de integração para listagem com filtros e paginação
- [x] 5.5 Executar a suíte de testes e garantir que todos passam

## Why

A Etapa 4 entregou o registro de movimentações simples (receitas e despesas), mas o sistema ainda não consegue representar dívidas parceladas — um caso central da experiência financeira (cartão de crédito, financiamentos, compras a prazo). Esta etapa adiciona o domínio de Dívidas e Parcelas conforme `plano.md` §5.5 e §6.2, incluindo ciclo de vida completo: registro com geração automática de parcelas, confirmação de pagamento (que gera despesa automática), deleção com regras de integridade, e invalidação de projeção. Sem isso, o motor de projeção (Etapa 6) não tem como calcular `total_dividas_pendentes` nem refletir o efeito bola de neve de parcelas vencidas.

## What Changes

- Criação das entidades `Divida` e `ParcelaDivida` no schema Drizzle/PostgreSQL.
- Endpoint `POST /dividas` com geração automática de N parcelas mensais a partir de `data_inicio`, aplicando a regra de arredondamento (últimas parcelas com valor truncado em 2 casas e a última absorvendo a diferença).
- Endpoint `GET /dividas` com paginação e filtro por `status` (`pendente` | `quitada`) baseado em `data_pagamento` das parcelas.
- Endpoint `DELETE /dividas/{dividaId}` com bloqueio `422` (`DEBT_HAS_PAYMENTS`) quando ao menos uma parcela já foi paga.
- Endpoint `PATCH /dividas/{dividaId}/parcelas/{parcelaId}/pagamento` que preenche `data_pagamento` e **gera automaticamente uma movimentação do tipo despesa** vinculada à parcela via `movimentacoes.parcela_divida_id`.
- Validação de que `categoriaId` da dívida pertence ao tipo `divida`.
- Ativação da detecção "movimentação gerada pelo sistema" já prevista na Etapa 4: `DELETE /movimentacoes/{id}` passa a retornar `422 SYSTEM_GENERATED_RESOURCE` quando a movimentação está vinculada a uma parcela.
- Invalidação síncrona de projeções a partir do mês da primeira parcela afetada, seguindo o mesmo padrão da Etapa 4 (UPDATE em `projecao.status`, no-op se a tabela ainda não existir).

## Capabilities

### New Capabilities
- `debt-management`: Registro de dívidas, geração de parcelas com arredondamento, listagem com status derivado, deleção condicional e ciclo de vida.
- `installment-payment`: Confirmação de pagamento de parcela, geração de despesa automática vinculada e invalidação de projeção.

### Modified Capabilities
- `transaction-management`: O cenário `SYSTEM_GENERATED_RESOURCE` em `DELETE /movimentacoes/{id}` deixa de ser no-op e passa a bloquear deleção de movimentações vinculadas a parcelas (`movimentacoes.parcela_divida_id IS NOT NULL`).

## Impact

- Novas tabelas `dividas` e `parcelas_divida` no schema Drizzle; nova migration.
- Schema `movimentacoes` já possui a coluna `parcela_divida_id` (criada na Etapa 4 sem FK). Nesta etapa a FK para `parcelas_divida(id)` é adicionada.
- Novas rotas Fastify em `src/routes/debts.ts` e novo service `src/services/debt-service.ts`.
- O service de transações passa a expor/consumir a função `isSystemGenerated` efetiva, substituindo o no-op atual.
- Invalidação de projeção reutiliza o helper já existente; nenhum EventEmitter é introduzido (continua reservado à Etapa 6).
- Coleção manual em `.posting/` ganha requests para o ciclo de vida de dívidas.

## Context

Etapas 1–4 entregaram a fundação operacional: autenticação OIDC, CRUD de categorias/contas, RBAC contextual por conta, e movimentações (receitas/despesas) com invalidação síncrona de projeções. A tabela `movimentacoes` já foi criada com a coluna `parcela_divida_id` (sem FK, preparada para esta etapa) e o service de transações já contém o gatilho `SystemGeneratedResourceError` disparado quando `parcela_divida_id != null` — porém hoje esse vínculo nunca é populado porque as entidades de dívida ainda não existem.

Esta etapa fecha o laço: introduz `Divida` e `ParcelaDivida`, gera parcelas automaticamente a partir de `data_inicio`, confirma pagamentos gerando despesa vinculada, e bloqueia deleção quando qualquer parcela já foi paga. Com isso, a detecção de movimentação "gerada pelo sistema" deixa de ser teórica e o motor de projeção da Etapa 6 passa a ter toda a base de dados que precisa.

## Goals / Non-Goals

**Goals:**
- Modelar `Divida` e `ParcelaDivida` no schema Drizzle seguindo `plano.md` §4.
- Adicionar a FK `movimentacoes.parcela_divida_id → parcelas_divida.id` que foi deixada pendente na Etapa 4.
- Expor rotas REST `POST /dividas`, `GET /dividas`, `DELETE /dividas/{id}`, `PATCH /dividas/{dividaId}/parcelas/{parcelaId}/pagamento`.
- Gerar N parcelas mensais ao criar uma dívida, aplicando regra de arredondamento do plano §5.5 (N-1 truncadas em 2 casas + última absorvendo a diferença).
- Gerar uma `Movimentacao` de despesa automaticamente na confirmação de pagamento, vinculada à parcela via `parcela_divida_id`.
- Bloquear `DELETE /dividas/{id}` com `422 DEBT_HAS_PAYMENTS` quando alguma parcela tenha `data_pagamento IS NOT NULL`.
- Bloquear `PATCH .../pagamento` em parcela já paga com `422 ALREADY_PAID`.
- Validar que `categoriaId` da dívida pertence ao tipo `divida`.
- Manter o padrão de invalidação síncrona de projeções (UPDATE tolerante a `42P01`, sem EventEmitter).

**Non-Goals:**
- Implementar o motor de projeção (Etapa 6) nem cálculo de `total_dividas_pendentes`.
- Permitir edição de dívida (`PATCH /dividas/{id}`): fora do contrato do plano §5.5.
- Permitir edição de parcelas além da confirmação de pagamento (valor, data de vencimento etc.).
- Suportar pagamentos parciais, estornos ou refinanciamento.
- Expor eventos de domínio para consumidores externos (MCP, webhooks).

## Decisions

### 1. Schema das tabelas `dividas` e `parcelas_divida`

`dividas`:
- `id` UUID PK.
- `conta_id` UUID NOT NULL FK `contas(id) ON DELETE CASCADE`.
- `usuario_id` UUID NOT NULL FK `usuarios(id)` (autoria).
- `categoria_id` UUID NOT NULL FK `categorias(id)` (tipo deve ser `divida`).
- `descricao` VARCHAR(255) NOT NULL.
- `valor_total` NUMERIC(12,2) NOT NULL.
- `total_parcelas` INTEGER NOT NULL (>= 1 via CHECK ou via service).
- `valor_parcela` NUMERIC(12,2) NOT NULL (valor base truncado, já gravado para consulta rápida).
- `data_inicio` DATE NOT NULL (vencimento da 1ª parcela).
- `created_at`, `updated_at` TIMESTAMP WITH TIME ZONE.

`parcelas_divida`:
- `id` UUID PK.
- `divida_id` UUID NOT NULL FK `dividas(id) ON DELETE CASCADE`.
- `numero_parcela` INTEGER NOT NULL (1..N).
- `valor` NUMERIC(12,2) NOT NULL.
- `data_vencimento` DATE NOT NULL.
- `data_pagamento` DATE NULL.
- `created_at`, `updated_at` TIMESTAMP WITH TIME ZONE.
- UNIQUE(`divida_id`, `numero_parcela`) para garantir sequência única.

A FK `movimentacoes.parcela_divida_id` passa a referenciar `parcelas_divida(id)` com `ON DELETE SET NULL`. Motivação: a `DELETE /dividas/{id}` só é permitida quando nenhuma parcela foi paga, portanto nunca haverá movimentações vinculadas a uma dívida sendo deletada; mesmo assim, `SET NULL` é conservador. Alternativa considerada: `RESTRICT`. Rejeitada porque criaria bloqueio cruzado que pode mascarar bugs de integridade — preferimos falhar cedo na regra de negócio (`DEBT_HAS_PAYMENTS`) e deixar a FK como rede de segurança.

### 2. Geração de parcelas com arredondamento

Algoritmo no service `createDebt`:
1. `valorBase = truncate(valor_total / total_parcelas, 2)` — truncagem explícita, não arredondamento bancário. Usamos `Math.floor(x * 100) / 100` aplicado sobre uma representação numérica segura.
2. `valorUltima = valor_total - valorBase * (total_parcelas - 1)` — absorve qualquer resíduo, incluindo casos com divisão exata (onde `valorUltima === valorBase`).
3. Datas de vencimento calculadas mês a mês a partir de `data_inicio`. Para evitar surpresas em fins de mês (ex.: `2024-01-31` + 1 mês ≠ `2024-02-31`), usamos `date-fns` (já dependência) `addMonths(data_inicio, i)` — a biblioteca normaliza para o último dia do mês quando necessário.
4. Todas as parcelas são inseridas em uma única transação Drizzle junto com a dívida, garantindo atomicidade.

Para preservar precisão decimal, os cálculos são feitos em **centavos (inteiros)** e convertidos para string `NUMERIC(12,2)` apenas ao persistir. Alternativa considerada: usar `Decimal.js`. Rejeitada pelo custo de adicionar dependência para um caso localizado — o cálculo inteiro resolve sem ambiguidade.

### 3. Confirmação de pagamento e geração de despesa automática

`PATCH /dividas/{dividaId}/parcelas/{parcelaId}/pagamento` roda em uma única transação:
1. Carrega a parcela com `SELECT ... FOR UPDATE` (lock pessimista) para evitar race em cliques duplos.
2. Se `data_pagamento IS NOT NULL` → lança `AlreadyPaidError` (422, `ALREADY_PAID`).
3. Atualiza `data_pagamento = body.data_pagamento`, `updated_at = now()`.
4. Insere uma nova `Movimentacao`:
   - `conta_id` = `divida.conta_id`.
   - `usuario_id` = usuário autenticado (quem confirmou o pagamento, não necessariamente quem registrou a dívida).
   - `categoria_id` = `divida.categoria_id` (reaproveita a categoria de dívida).
   - `descricao` = `"Parcela N/M — {divida.descricao}"`.
   - `valor` = `parcela.valor`.
   - `data` = `data_pagamento`.
   - `recorrente` = `false`.
   - `parcela_divida_id` = `parcela.id`.
5. Invalida projeções a partir do menor mês entre `data_pagamento` e `data_vencimento` (conservador — cobre o caso de pagamento antecipado que esvazia o passivo futuro).
6. Resposta `200` com a parcela atualizada e `movimentacao_gerada` aninhada (seguindo o payload de `plano.md` §5.5).

Nota sobre tipo de categoria: a despesa gerada usa categoria do tipo `divida`, não `despesa`. A listagem `GET /movimentacoes` hoje filtra por `tipo` olhando `tipo_categorias.slug` — o frontend/projeção precisará tratar `divida` como despesa efetiva para o saldo. Alternativa considerada: criar uma categoria espelho do tipo `despesa` "Pagamento de Parcela". Rejeitada porque multiplica cadastros e afasta da semântica do plano §6.2 que diz explicitamente "a parcela sai de `total_dividas_pendentes` e vira despesa real" — a categoria permanece a mesma, muda o efeito no saldo.

### 4. Ativação do bloqueio `SYSTEM_GENERATED_RESOURCE`

O service `deleteTransaction` já lê `movimentacoes.parcela_divida_id` e lança `SystemGeneratedResourceError` quando não-nulo. A partir desta etapa, movimentações geradas em (3) terão esse campo populado automaticamente pela FK inserida na mesma transação — nenhum código adicional necessário em `transaction-service.ts`.

A migration adiciona a constraint FK `movimentacoes.parcela_divida_id → parcelas_divida(id) ON DELETE SET NULL` que não existia antes. Como nenhuma linha possui valor populado no momento da migration, é seguro aplicar sem script de backfill.

### 5. Regras de deleção

`DELETE /dividas/{dividaId}`:
1. Carrega a dívida (404 se não existir).
2. Autoriza via `requireAccountRole("owner")` com `contaId` extraído da dívida.
3. Query `SELECT 1 FROM parcelas_divida WHERE divida_id = $1 AND data_pagamento IS NOT NULL LIMIT 1`.
4. Se encontrou → `DebtHasPaymentsError` (422, `DEBT_HAS_PAYMENTS`).
5. Senão → `DELETE FROM dividas WHERE id = $1` (cascade remove parcelas pelo FK).
6. Invalida projeções a partir de `data_inicio` da dívida.

Alternativa considerada: soft-delete (`deleted_at`). Rejeitada porque o plano §5.5 explicitamente fala em remoção física. Mantemos o comportamento observável pedido.

### 6. Listagem com status derivado

`GET /dividas?contaId=...&status=pendente|quitada`:
- Status é derivado em SQL via subquery: uma dívida é `quitada` quando `COUNT(*) FILTER (WHERE data_pagamento IS NULL) = 0`.
- Filtro `status` aplica `HAVING` sobre essa contagem.
- Paginação segue o mesmo formato de `/movimentacoes` (`{ data, pagination: { page, limit, total, totalPages, hasNext, hasPrev } }`).
- Cada item inclui resumo das parcelas (`total_parcelas`, `parcelas_pagas`, `parcelas_pendentes`) para evitar round-trip ao frontend.

Alternativa considerada: coluna materializada `status` na tabela `dividas`. Rejeitada pelo risco de drift — o estado verdadeiro está nas parcelas.

### 7. Invalidação de projeção

Usa o mesmo helper `invalidateProjections(contaId, dataReferencia)` já exportado por `transaction-service.ts`. Refatoração: mover o helper para um módulo compartilhado `src/services/projection-invalidation.ts` para evitar dependência circular entre `debt-service` e `transaction-service`. Ambos passam a importar do novo módulo.

Mutações que invalidam:
- `POST /dividas` → mês de `data_inicio`.
- `DELETE /dividas/{id}` → mês de `data_inicio`.
- `PATCH .../pagamento` → menor mês entre `data_pagamento` e `data_vencimento`.

### 8. Erros novos

Em `src/lib/errors.ts`, adicionar classes que faltavam:
```ts
export class AlreadyPaidError extends AppError { /* 422, ALREADY_PAID */ }
export class DebtHasPaymentsError extends AppError { /* 422, DEBT_HAS_PAYMENTS */ }
```
Os códigos já estão declarados em `ErrorCode`, então basta criar os wrappers.

## Risks / Trade-offs

- [Risk] Condição de corrida em cliques duplos de confirmação de pagamento (duas requests simultâneas podem inserir duas movimentações). → Mitigação: `SELECT ... FOR UPDATE` da parcela dentro da transação, garantindo serialização.
- [Risk] Arredondamento em ponto flutuante pode acumular centavos perdidos (R$1.000 / 3 = 333.333...). → Mitigação: cálculo inteiro em centavos e reserva explícita do resíduo na última parcela; testes cobrem casos 3x, 7x, 11x.
- [Risk] `addMonths` pode colapsar datas (31/01 → 28/02). → Mitigação: aceito como comportamento correto e documentado — o plano não impõe preservação literal do dia. Teste explícito cobre o caso.
- [Risk] FK `movimentacoes.parcela_divida_id` adicionada em migration sobre coluna já existente pode falhar se algum teste antigo persistiu lixo. → Mitigação: rodar `drizzle-kit` em ambiente limpo; o ambiente de dev/teste usa containers descartáveis (`docker compose down -v` antes de aplicar migrations).
- [Risk] Deleção em cascata remove parcelas silenciosamente se a regra de `DEBT_HAS_PAYMENTS` falhar. → Mitigação: a checagem ocorre antes do DELETE e é coberta por teste de integração com parcela paga; a FK `ON DELETE CASCADE` só atua em deleções autorizadas.
- [Risk] A despesa gerada usa categoria do tipo `divida`, o que pode surpreender listagens que esperam `tipo = despesa`. → Mitigação: documentado neste design e nas specs; a Etapa 6 terá que tratar categorias do tipo `divida` pagas como despesa ao calcular saldo. Alternativa (categoria espelho) foi rejeitada na Decisão 3.

## Migration Plan

1. Criar migration Drizzle com:
   - `CREATE TABLE dividas (...)`.
   - `CREATE TABLE parcelas_divida (...)` + UNIQUE.
   - `ALTER TABLE movimentacoes ADD CONSTRAINT movimentacoes_parcela_divida_fk FOREIGN KEY (parcela_divida_id) REFERENCES parcelas_divida(id) ON DELETE SET NULL`.
2. Aplicar via `npm run db:migrate` dentro do container de API (`docker compose exec api`).
3. Rollback: migration reversa gerada pelo Drizzle (`DROP TABLE parcelas_divida; DROP TABLE dividas; ALTER TABLE movimentacoes DROP CONSTRAINT movimentacoes_parcela_divida_fk`). Nenhum dado é perdido em contas existentes porque a coluna `parcela_divida_id` continua válida, apenas sem a constraint.

## Open Questions

- Categoria do tipo `divida` pode ser usada em movimentação manual (via `POST /movimentacoes`)? Plano §5.4 diz que `tipo` aceita só `receita` ou `despesa`, então a resposta é não — o service atual já rejeita (`validateCategoriaTipo` exige slug igual). Nenhuma mudança necessária, mas vale explicitar nos testes para fixar o contrato.
- Pagamento em lote (confirmar várias parcelas de uma vez) entra em escopo? Por ora **não** — o plano só define o endpoint singular. Se surgir demanda, abre-se change separada.

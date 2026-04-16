## Context

A Etapa 4 (Movimentações) do `plano.md` foi concluída funcionalmente, mas a auditoria manual revelou que `createTransaction` e `updateTransaction` em `src/services/transaction-service.ts` não validam a positividade de `valor`. O schema do banco (`DECIMAL(12,2)`) aceita negativos naturalmente, e nenhuma regra de negócio é aplicada no serviço. O resultado é que `valor = 0` e `valor = -50` são persistidos com `HTTP 201`.

Além disso, o plugin `requireAccountRole` (em `src/plugins/account-authorization.ts:43-50`) retorna `400 VALIDATION_ERROR` quando `contaId` não é encontrado na requisição. A spec `transaction-management` existente já documenta esse `400` (linha 71 de `openspec/specs/transaction-management/spec.md`), mas a padronização de `plano.md §10` lista apenas `401/403/404/422` — divergência entre a spec aprovada e o plano base.

O código `BusinessRuleError` em `src/lib/errors.ts` já mapeia para `422 BUSINESS_RULE_VIOLATION` no handler global de erros. A mesma infraestrutura já é usada em `validateRecorrencia` e `validateCategoriaTipo`. Portanto, a validação de `valor > 0` reaproveita o padrão vigente.

Stakeholders: backend (Igor Guariroba). Sem impacto em clientes já existentes — apenas rejeita entradas que o plano já considerava inválidas.

## Goals / Non-Goals

**Goals:**
- Rejeitar `valor <= 0` em `POST /movimentacoes` e `PUT /movimentacoes/{id}` com `422 BUSINESS_RULE_VIOLATION`.
- Padronizar o status de "contaId ausente" em `GET /movimentacoes` para `422 VALIDATION_ERROR`, alinhando ao `plano.md §10`.
- Atualizar a spec `transaction-management` e os testes automatizados (`tests/transactions.test.ts`) para refletir o novo comportamento.

**Non-Goals:**
- Implementar o EventEmitter `projecao:recalcular` — fica para Etapa 6 (Motor de Projeção).
- Revisar padronização de status `400` em outras rotas (`/categorias`, `/contas`, `/account-members`) — fora do escopo desta mudança.
- Alterar schema do banco para `CHECK (valor > 0)` — preferimos validação em camada de serviço para retornar erro de negócio legível antes de chegar ao banco.
- Criar novos arquivos `.posting` — a coleção manual existente cobre o happy-path; cenários negativos são validados via curl ad hoc pelo skill `run-manual-tests`.

## Decisions

### 1. Onde validar `valor > 0`

**Decisão:** adicionar uma função `validateValor(valor: number)` em `src/services/transaction-service.ts` que lança `BusinessRuleError("valor must be greater than zero")` quando `valor <= 0`. Chamar no início de `createTransaction` (antes de `validateRecorrencia`) e em `updateTransaction` (quando `input.valor` estiver definido).

**Alternativas consideradas:**
- **Zod/schema Fastify na rota:** aumentaria a superfície de dependências e geraria `400` em vez de `422`. O padrão do projeto hoje é validar em serviço e usar `BusinessRuleError`.
- **CHECK constraint no banco:** erro de banco é genérico e não conversa com o contrato `plano.md §10`. Mantemos a validação no serviço.

### 2. Status code para `contaId` ausente no GET

**Decisão:** alterar `requireAccountRole` em `src/plugins/account-authorization.ts` para retornar `422 VALIDATION_ERROR` quando `contaId` não é resolvido, ao invés de `400`. O código `VALIDATION_ERROR` permanece conforme já praticado pelo plugin — apenas o HTTP status muda.

**Alternativas consideradas:**
- **Manter `400`:** é semanticamente mais correto por RFC 9110 (validação sintática de input), mas contraria a padronização de `plano.md §10`. Em projeto novo preferiríamos `400`; aqui seguimos o plano para eliminar a divergência.
- **Criar um novo hook dedicado ao GET:** desnecessário; a mudança é de uma única linha (`reply.status(400)` → `reply.status(422)`).

### 3. Atualização da spec `transaction-management`

**Decisão:** modificar a spec existente adicionando um requirement "Validação de valor positivo" com cenários explícitos (`valor = 0` e `valor < 0`), e alterar o scenario "Listagem sem contaId" para `422`. Mantém os demais requirements intactos.

**Alternativas consideradas:**
- **Criar capability separada `transaction-validation`:** fragmentaria a spec. A validação é parte intrínseca do CRUD.

### 4. Cobertura de testes

**Decisão:** `tests/transactions.test.ts` recebe 3 novos testes:
1. POST com `valor = 0` → `422 BUSINESS_RULE_VIOLATION`.
2. POST com `valor = -50` → `422 BUSINESS_RULE_VIOLATION`.
3. PUT atualizando `valor` para `0` → `422 BUSINESS_RULE_VIOLATION`.

O teste existente de "GET sem contaId" precisa ter a expectativa atualizada de `400` para `422`.

## Risks / Trade-offs

- **Risco:** um cliente externo que hoje envie `valor = 0` por engano recebe `422` em vez de `201`. → **Mitigação:** comportamento está em conformidade com o plano e nenhum cliente em produção consome a API ainda; a Etapa 4 ainda não foi arquivada, então não há contrato público cristalizado.
- **Risco:** a mudança de `400 → 422` pode confundir consumidores que leem apenas o HTTP status para distinguir "input inválido" vs "regra de negócio". → **Mitigação:** o campo `code` no body (`VALIDATION_ERROR` vs `BUSINESS_RULE_VIOLATION`) continua diferenciando; é esse o mecanismo que o frontend deve usar.
- **Trade-off:** ao validar `valor` em serviço (não em schema), erros de tipo (`valor: "abc"`) ainda caem em fluxo de parsing de body do Fastify (retornando `400` de parse nativo). Isso é aceitável — o serviço assume `valor: number` e o erro de tipo é problema de formato, não de regra de negócio.

## Migration Plan

Não há migração de banco. A implementação segue os passos:

1. Adicionar `validateValor` e chamadas em `createTransaction`/`updateTransaction`.
2. Ajustar `reply.status(400)` → `reply.status(422)` em `requireAccountRole`.
3. Atualizar `tests/transactions.test.ts`.
4. Atualizar spec em `openspec/specs/transaction-management/spec.md` via delta (arquivos em `specs/` desta change).
5. Rodar `docker compose build api && docker compose up -d api && npm test` para validação automatizada.
6. Rodar o skill `run-manual-tests` com casos negativos para validação manual end-to-end.

Rollback: reverter o commit. Sem dados persistidos a limpar.

## Open Questions

- Nenhuma. Todas as decisões estão fechadas com base em `plano.md`, spec vigente e padrões do projeto.

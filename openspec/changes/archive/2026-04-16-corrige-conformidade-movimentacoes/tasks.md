## 1. Implementação no serviço de movimentações

- [x] 1.1 Adicionar função `validateValor(valor: number)` em `src/services/transaction-service.ts` que lança `BusinessRuleError("valor must be greater than zero")` quando `valor <= 0`
- [x] 1.2 Chamar `validateValor(input.valor)` em `createTransaction`, antes de `validateRecorrencia`
- [x] 1.3 Chamar `validateValor(input.valor)` em `updateTransaction` quando `input.valor !== undefined`

## 2. Ajuste de status no plugin de autorização

- [x] 2.1 Em `src/plugins/account-authorization.ts`, alterar `reply.status(400)` para `reply.status(422)` no bloco que retorna quando `contaId` não é resolvido (linhas ~43-50); manter `code: "VALIDATION_ERROR"`

## 3. Testes automatizados

- [x] 3.1 Adicionar em `tests/transactions.test.ts` teste "POST /movimentacoes rejeita valor=0 com 422"
- [x] 3.2 Adicionar teste "POST /movimentacoes rejeita valor negativo com 422"
- [x] 3.3 Adicionar teste "PUT /movimentacoes/:id rejeita valor=0 com 422"
- [x] 3.4 Atualizar teste existente "GET /movimentacoes sem contaId" para esperar `422` em vez de `400`
- [x] 3.5 Rodar `docker compose run --rm test` (ou comando equivalente do projeto) e garantir suíte 100% verde

## 4. Atualização da documentação viva

- [x] 4.1 Aplicar delta de `openspec/changes/corrige-conformidade-movimentacoes/specs/transaction-management/spec.md` em `openspec/specs/transaction-management/spec.md` (via `/opsx:sync` ou manualmente durante `/opsx:archive`)
- [x] 4.2 Rodar `openspec validate corrige-conformidade-movimentacoes --strict` e garantir saída sem erros

## 5. Validação end-to-end manual

- [x] 5.1 Executar `docker compose build api && docker compose up -d api` para garantir que a imagem reflete as alterações
- [x] 5.2 Rodar o skill `run-manual-tests` cobrindo `POST valor=0`, `POST valor=-50`, `PUT valor=0` e `GET sem contaId`, confirmando `422` em todos
- [x] 5.3 Registrar no PR/commit o resultado dos testes manuais

## Why

A auditoria de conformidade da Etapa 4 contra `plano.md` identificou três divergências funcionais em `/movimentacoes` (validada com testes manuais em 2026-04-16): (1) `valor <= 0` é aceito e gera registro com `HTTP 201` — o plano §5.4 exige `valor` estritamente positivo com `422`; (2) `GET /movimentacoes` sem `contaId` retorna `400 VALIDATION_ERROR`, mas `plano.md §10` lista apenas `401/403/404/422` como códigos de status esperados. Um quarto ponto — a não emissão do evento `projecao:recalcular` via EventEmitter — é registrado como gap conhecido para a Etapa 6, sem ação imediata nesta mudança.

## What Changes

- Adicionar validação `valor > 0` em `createTransaction` e `updateTransaction` no serviço de movimentações, retornando `422 BUSINESS_RULE_VIOLATION` quando `valor <= 0` (inclui `POST` e `PUT` de `/movimentacoes`).
- Alinhar status de "contaId ausente" no `GET /movimentacoes` para `422 VALIDATION_ERROR`, mantendo o código `VALIDATION_ERROR` definido em `plano.md §10`.
- Atualizar a spec `transaction-management` com novos cenários cobrindo `valor > 0` e ajustar o cenário "Listagem sem contaId" para `422`.
- Registrar no changelog da Etapa 4 que o gap de emissão do evento `projecao:recalcular` permanece aberto e é pré-requisito para a Etapa 6.

## Capabilities

### New Capabilities
<!-- Nenhuma capability nova -->

### Modified Capabilities

- `transaction-management`: passa a exigir `valor > 0` em `POST /movimentacoes` e `PUT /movimentacoes/{id}`; ajusta o código de status de "contaId ausente no GET" de `400` para `422`.

## Impact

- Código afetado: `src/services/transaction-service.ts` (funções `createTransaction` e `updateTransaction`) e `src/routes/transactions.ts` (handler do `GET /movimentacoes` — caso o status 400 esteja vindo do plugin `requireAccountRole`, o ajuste é em `src/plugins/account-authorization.ts` para retornar `422` quando `contaId` for obrigatório e estiver ausente).
- Testes automatizados: `tests/transactions.test.ts` precisa cobrir cenários `valor = 0`, `valor < 0` e ajustar a expectativa do status do GET sem `contaId`.
- Coleção manual `.posting/movimentacoes/`: não requer novos arquivos; os cenários negativos já são validados ad hoc via curl no fluxo do skill `run-manual-tests`.
- Sem impacto em schema de banco, sem migração, sem breaking change para clientes bem-comportados (apenas rejeita entradas que já eram inválidas segundo o plano).
- Dependência de terceiros: nenhuma.

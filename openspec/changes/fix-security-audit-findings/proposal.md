## Why

A auditoria de segurança na API HTTP e no MCP HTTP identificou vulnerabilidades de IDOR (Insecure Direct Object Reference) nas ferramentas MCP de transações, além de fragilidades na cadeia de suprimento do pipeline CI/CD. Esses problemas permitem que usuários autenticados acessem ou modifiquem recursos de outras contas, e expõem o repositório a riscos de supply chain via actions de terceiros não fixadas.

## What Changes

- Corrigir IDOR em `transactions.delete` do MCP: validar que a transação a ser deletada pertence à conta autorizada.
- Corrigir IDOR em `transactions.update` do MCP: validar que a transação a ser atualizada pertence à conta autorizada.
- Adicionar limite de memória (LRU) ao rate limiter em memória do MCP para prevenir DoS.
- Fixar todas as actions de terceiros no workflow CI/CD por SHA (supply chain security).
- Restringir permissões do `GITHUB_TOKEN` no workflow CI/CD ao mínimo necessário (`contents: read`).
- Adicionar `timeout-minutes` em todos os jobs do workflow CI/CD.
- Reforçar documentação no `docker-compose.test.yml` sobre uso exclusivo em testes.

## Capabilities

### New Capabilities
- `ci-security-hardening`: Hardening do pipeline CI/CD (pin de actions por SHA, permissões mínimas, timeouts).
- `mcp-rate-limiter-hardening`: Proteção contra estouro de memória no rate limiter do MCP HTTP.

### Modified Capabilities
- `mcp-service-account`: Requisitos de autorização para tool calls devem garantir que operações sobre recursos (transações) verifiquem a propriedade real do recurso, não apenas o `contaId` passado no input.
- `transaction-management`: As operações de update e delete via MCP devem validar a conta real da transação antes de executar.

## Impact

- `src/mcp/tools/transactions.ts`: alterações nas handlers de update e delete.
- `src/plugins/mcp-http.ts`: alteração no rate limiter.
- `.github/workflows/ci.yml`: pin de actions, permissões, timeouts.
- `.github/actions/setup-node-deps/action.yml`: pin da action `actions/setup-node`.
- `docker-compose.test.yml`: comentários de segurança adicionais.

## Why

A auditoria de segurança contínua identificou uma vulnerabilidade CRITICAL de SQL Injection em `category-service.ts`, onde input do usuário é concatenado diretamente em queries SQL. Além disso, o pipeline CI/CD permanece exposto a riscos de supply chain por usar actions de terceiros com tags mutáveis e permissões excessivas do `GITHUB_TOKEN`.

## What Changes

- Corrigir SQL Injection em `src/services/category-service.ts:52` (concatenação de `categoriaId` em `sql.raw`).
- Fixar todas as actions de terceiros no workflow CI/CD por SHA completo.
- Restringir permissões do `GITHUB_TOKEN` ao mínimo necessário (`contents: read`).
- Adicionar `timeout-minutes` em todos os jobs do workflow CI/CD.

## Capabilities

### New Capabilities
- `ci-security-hardening`: Hardening do pipeline CI/CD (pin de actions por SHA, permissões mínimas, timeouts).

### Modified Capabilities
- `category-management`: O sistema deve rejeitar deleção de categorias com vínculos sem construir queries SQL dinâmicas com input do usuário.

## Impact

- `src/services/category-service.ts`: substituir `sql.raw` por query parametrizada.
- `.github/workflows/ci.yml`: pin de actions, permissões, timeouts.
- `.github/actions/setup-node-deps/action.yml`: pin da action `actions/setup-node`.

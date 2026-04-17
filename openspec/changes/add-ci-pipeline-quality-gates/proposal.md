## Why

Hoje o repositório só possui um workflow isolado de SonarCloud; não há gates de qualidade obrigatórios em PR (lint, typecheck, testes, cobertura) nem proteção da branch `master`. Qualquer commit pode ir para `master` sem garantias, e as regras de qualidade ficam dispersas entre `package.json`, `eslint.config.js` e `sonar-project.properties` sem um pipeline que as orquestre de forma desacoplada. Queremos um pipeline de CI que exija qualidade no código antes do merge, com jobs independentes (baixo acoplamento) e Branch Protection versionada como código.

## What Changes

- Adiciona workflow unificado `.github/workflows/ci.yml` com jobs independentes e paralelos: `lint`, `typecheck`, `test`, `coverage-sonar`, `build`.
- Extrai setup comum (checkout, Node, cache `npm ci`) para uma composite action local (`.github/actions/setup-node-deps`) para desacoplar infra dos gates.
- Consolida a análise SonarCloud dentro do pipeline unificado e remove o workflow dedicado `.github/workflows/sonarcloud.yml` (evita duplicação de checkout/install). **BREAKING** (apenas para CI): nome do status check do Sonar muda de `SonarCloud Scan` para `ci / coverage-sonar`.
- Adiciona script versionado `scripts/branch-protection.sh` que aplica Branch Protection Rules na `master` via `gh api` (required status checks = todos os jobs do `ci.yml`, require PR review, require linear history, dismiss stale reviews).
- Adiciona documentação `docs/ci.md` explicando como rodar cada gate localmente (mesmo comando que o CI executa) e como aplicar/atualizar a proteção de branch.
- Define thresholds de qualidade no código: cobertura mínima em `vitest.config.ts` (`coverage.thresholds`), não na UI do SonarCloud.

## Capabilities

### New Capabilities
- `ci-pipeline`: workflow GitHub Actions que executa gates de qualidade (lint, typecheck, testes, cobertura, build) de forma desacoplada em PRs e pushes para `master`.
- `branch-protection`: regras de proteção da branch `master` gerenciadas como código via script idempotente com `gh` CLI, versionado no repositório.

### Modified Capabilities
- `sonarcloud-integration`: análise passa a rodar como job dentro do pipeline unificado de CI em vez de workflow dedicado; passa a depender do artefato de cobertura produzido pelo job `coverage-sonar`.

## Impact

- **Novos arquivos**: `.github/workflows/ci.yml`, `.github/actions/setup-node-deps/action.yml`, `scripts/branch-protection.sh`, `docs/ci.md`.
- **Removido**: `.github/workflows/sonarcloud.yml` (conteúdo migrado).
- **Alterado**: `vitest.config.ts` (adiciona thresholds de cobertura), `README.md` (link para `docs/ci.md`).
- **Processo**: todo PR passa a exigir todos os jobs verdes antes do merge. Admins devem rodar `scripts/branch-protection.sh` uma vez para aplicar as regras (requer `GITHUB_TOKEN` com escopo `repo`).
- **Sem impacto em runtime**: nenhuma mudança em código de aplicação, apenas infra de qualidade.
- **Segredos necessários**: `SONAR_TOKEN` já existe; nenhum novo segredo é introduzido.

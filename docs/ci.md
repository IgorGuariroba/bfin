# CI Pipeline & Branch Protection

Este documento descreve o pipeline de CI do BFin e o processo de aplicação das
Branch Protection Rules em `master`.

## Visão geral

O workflow está em [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) e é
acionado em:

- `pull_request` com alvo `master`
- `push` em `master`

O pipeline executa cinco jobs paralelos e independentes — um job falhando não
bloqueia os demais. Todos compartilham o setup via a composite action
[`.github/actions/setup-node-deps`](../.github/actions/setup-node-deps/action.yml)
(Node 22 + cache npm + `npm ci`). O checkout do repositório é feito pelo próprio
job antes de chamar a composite (exigência do GitHub Actions para resolver
composite actions locais).

## Jobs vs. comandos locais

Para depurar uma falha, basta rodar localmente o mesmo comando que o CI executa:

| Job (status check)       | Comando local equivalente                 | Objetivo                                               |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------ |
| `ci / lint`              | `npm run lint`                            | ESLint + SonarJS em `src/`                             |
| `ci / typecheck`         | `npm run typecheck`                       | `tsc --noEmit` — só tipos, sem emitir build            |
| `ci / test`              | `npx vitest run`                          | Suíte Vitest direto no runner (sem docker compose)     |
| `ci / coverage-sonar`    | `npm run test:coverage`                   | Coverage + thresholds + análise SonarCloud             |
| `ci / build`             | `npm run build`                           | Compilação TypeScript para `dist/`                     |

> Convenção do projeto: para dev e testes manuais, use `docker compose` (ver
> [`CLAUDE.md`](../CLAUDE.md)). Os comandos acima refletem o que o runner do CI
> executa — úteis para depurar localmente na mesma superfície do CI.

### Thresholds de cobertura

Ficam declarados em [`vitest.config.ts`](../vitest.config.ts) sob
`coverage.thresholds` e são aplicados tanto localmente quanto no CI. Mudá-los
passa pelo review de PR, sem depender da UI do SonarCloud.

## Branch Protection

A proteção de `master` é versionada no script
[`scripts/branch-protection.sh`](../scripts/branch-protection.sh). O JSON da
configuração vive inline (heredoc) para ser revisável em diff.

### Pré-requisitos

- `gh` CLI autenticado: `gh auth status` deve reportar sucesso.
- Token com escopo `repo` (padrão quando `gh auth login` usa OAuth web flow).
- Permissão de **admin** no repositório (necessária para alterar Branch
  Protection via API).

### Aplicando a proteção

```bash
./scripts/branch-protection.sh
```

O script é idempotente: `PUT /repos/{owner}/{repo}/branches/master/protection`
substitui o estado atual pelo JSON enviado. Rodá-lo duas vezes seguidas produz
exatamente a mesma configuração.

### Configuração aplicada

- **Required status checks** (`strict: true`): `ci / lint`, `ci / typecheck`,
  `ci / test`, `ci / coverage-sonar`, `ci / build`.
- **Required pull request reviews**: 1 aprovação, `dismiss_stale_reviews: true`
  (novos commits invalidam reviews anteriores).
- **Required linear history**: merges só via squash ou rebase; merge commits
  são bloqueados.
- **Enforce admins**: `false` (admins podem aplicar hotfix em emergência).
- **Force push** e **deletions**: bloqueados.

### Rollback

Para remover a proteção (ex.: migração de emergência):

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
gh api --method DELETE "/repos/${REPO}/branches/master/protection"
```

## Adicionando um novo gate de qualidade

Para introduzir um novo job (ex.: `lint-docs`, `security-scan`):

1. Adicione o job em `.github/workflows/ci.yml`, reutilizando a composite
   action `./.github/actions/setup-node-deps` quando precisar de Node.
2. Atualize `required_status_checks.contexts` em
   `scripts/branch-protection.sh` incluindo `ci / <novo-job>`.
3. Atualize a tabela "Jobs vs. comandos locais" acima.
4. Depois do merge, um admin executa `./scripts/branch-protection.sh` para
   aplicar o novo contexto como required status check em `master`.

Manter os três lugares em sincronia é o contrato do pipeline: se um job existe
em `ci.yml` mas não está no script, a proteção não exige ele; se está no script
mas não em `ci.yml`, PRs ficam presos esperando um check que nunca roda.

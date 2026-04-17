## 1. Preparação

- [ ] 1.1 Medir cobertura atual rodando `npm run test:coverage` localmente e anotar linhas/funções/branches/statements para calibrar thresholds iniciais
- [ ] 1.2 Definir valores de `coverage.thresholds` em `vitest.config.ts` (ponto de partida: próximo ao baseline atual, com margem) e validar que `npm run test:coverage` passa com os novos thresholds
- [ ] 1.3 Adicionar no `package.json` um script `typecheck` (`tsc --noEmit`) se ainda não existir, para desacoplar typecheck de build

## 2. Composite action de setup

- [ ] 2.1 Criar diretório `.github/actions/setup-node-deps/`
- [ ] 2.2 Escrever `.github/actions/setup-node-deps/action.yml` com steps: `actions/checkout@v4`, `actions/setup-node@v4` (node-version 22, cache npm), `npm ci`
- [ ] 2.3 Declarar a action como `composite` e validar sintaxe (`actionlint` ou push em branch de teste)

## 3. Workflow unificado `ci.yml`

- [ ] 3.1 Criar `.github/workflows/ci.yml` com triggers `on: pull_request` (branches: master) e `on: push` (branches: master) e `concurrency` para cancelar runs antigas do mesmo ref
- [ ] 3.2 Adicionar job `lint` que usa `./.github/actions/setup-node-deps` e roda `npm run lint`
- [ ] 3.3 Adicionar job `typecheck` que usa a composite action e roda `npm run typecheck`
- [ ] 3.4 Adicionar job `test` que usa a composite action e roda `npx vitest run` (sem docker compose)
- [ ] 3.5 Adicionar job `coverage-sonar` que roda `npm run test:coverage`, seguido por step `SonarSource/sonarcloud-github-action@master` com `SONAR_TOKEN` e `GITHUB_TOKEN` do secrets
- [ ] 3.6 Adicionar job `build` que usa a composite action e roda `npm run build`
- [ ] 3.7 Verificar que nenhum job declara `needs:` para outro (garantindo paralelismo e desacoplamento)

## 4. Migração da análise SonarCloud

- [ ] 4.1 Remover `.github/workflows/sonarcloud.yml`
- [ ] 4.2 Confirmar que `sonar-project.properties` continua válido para a nova execução dentro de `coverage-sonar` (paths não mudam)

## 5. Validação do pipeline

- [ ] 5.1 Abrir PR com as mudanças acima contra `master` e validar que todos os 5 jobs (`lint`, `typecheck`, `test`, `coverage-sonar`, `build`) aparecem no Checks tab e ficam verdes
- [ ] 5.2 Introduzir temporariamente um erro de lint em um arquivo para confirmar que o job `lint` falha isoladamente e os demais continuam rodando; depois reverter
- [ ] 5.3 Confirmar no dashboard do SonarCloud que a análise executou normalmente e que a cobertura aparece

## 6. Script de Branch Protection

- [ ] 6.1 Criar `scripts/branch-protection.sh` com shebang `#!/usr/bin/env bash`, `set -euo pipefail`, e um heredoc JSON contendo a configuração completa (required status checks com os 5 contextos `ci / lint`, `ci / typecheck`, `ci / test`, `ci / coverage-sonar`, `ci / build`; `strict: true`; `required_pull_request_reviews: {required_approving_review_count: 1, dismiss_stale_reviews: true}`; `required_linear_history: true`; `enforce_admins: false`; `restrictions: null`; `allow_force_pushes: false`; `allow_deletions: false`)
- [ ] 6.2 Usar `gh api --method PUT "/repos/{owner}/{repo}/branches/master/protection" --input -` recebendo o JSON via stdin; derivar `{owner}/{repo}` de `gh repo view --json nameWithOwner -q .nameWithOwner`
- [ ] 6.3 Marcar o script como executável (`chmod +x scripts/branch-protection.sh`) e adicionar ao git
- [ ] 6.4 Validar idempotência executando o script duas vezes em um repositório de teste ou fork e confirmando que o resultado é idêntico

## 7. Documentação

- [ ] 7.1 Criar `docs/ci.md` com: visão geral do pipeline, tabela de jobs vs. comando local equivalente, pré-requisitos para `scripts/branch-protection.sh` (token `gh` com escopo `repo`, permissão de admin), procedimento para adicionar novo gate (atualizar `ci.yml` + atualizar `contexts` no script + rodar o script)
- [ ] 7.2 Adicionar link para `docs/ci.md` na seção relevante do `README.md`

## 8. Aplicação da Branch Protection

- [ ] 8.1 Após merge do PR, admin executa `./scripts/branch-protection.sh` com `gh auth status` confirmado
- [ ] 8.2 Verificar em `Settings → Branches` no GitHub que a proteção de `master` mostra os 5 required status checks, review obrigatório e histórico linear ativos
- [ ] 8.3 Abrir um PR de teste (pode ser trivial, como atualização de comentário) e confirmar que o botão "Merge" fica desabilitado até que todos os checks passem e haja review aprovada

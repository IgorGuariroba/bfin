## Context

O repositório é uma API Fastify/TypeScript com testes em Vitest rodando dentro de `docker-compose.test.yml` (usa testcontainers de Postgres). Hoje existe apenas `.github/workflows/sonarcloud.yml`, que roda `npm ci + npm run test:coverage + SonarCloud Scan` acoplado em um único job — não há gates separados para lint, typecheck e build, e as regras de qualidade (ESLint, SonarJS, thresholds de cobertura) vivem em arquivos distintos sem um pipeline que as orquestre. A `master` não tem Branch Protection configurada, então o controle depende de convenção.

A mudança introduz o pipeline completo de CI com jobs desacoplados e proteção de branch gerenciada como código.

## Goals / Non-Goals

**Goals:**
- Cada gate (lint, typecheck, test, coverage+sonar, build) executa em job independente, em paralelo, falhando de forma isolada.
- Regras de qualidade ficam definidas no código (`eslint.config.js`, `tsconfig.json`, `vitest.config.ts` com thresholds), não em configuração externa ou UI.
- Setup de ambiente (checkout, Node 22, cache npm, `npm ci`) extraído em composite action para manter os jobs DRY sem acoplá-los entre si.
- Branch Protection versionada via script idempotente `scripts/branch-protection.sh` usando `gh api`, chamável localmente por um admin.
- Feedback rápido: um job que falha não bloqueia o start dos outros; devs veem lint errors sem esperar testes.

**Non-Goals:**
- Publicação de imagem Docker em registry (escopo futuro).
- Deploy automatizado para qualquer ambiente.
- Análises extras além de SonarCloud (CodeQL, Snyk, Dependabot PRs — podem vir depois).
- Gerenciar a proteção via Terraform/IaC (escolhido `gh` CLI pela simplicidade).
- Matrix builds entre versões de Node (projeto fixa Node 22).

## Decisions

### Decisão 1: Um único workflow `ci.yml` com múltiplos jobs vs. múltiplos workflows
**Escolhido:** um único `ci.yml` com jobs paralelos.

**Rationale:** GitHub Actions só considera um "status check" por job, independente de estar em 1 ou N workflows. Um único workflow permite que a composite action de setup seja referenciada de forma limpa, mantém os triggers consistentes (mesmo `on:` para todos os gates) e facilita a visualização no Checks tab. Cada job roda em runner próprio, então continua sendo "desacoplado" em runtime.

**Alternativa considerada:** um workflow por gate (`lint.yml`, `test.yml`, etc.). Descartado por duplicar os triggers e dificultar a exigência conjunta na Branch Protection.

### Decisão 2: Composite action local para setup vs. copiar steps
**Escolhido:** `.github/actions/setup-node-deps/action.yml` com os steps de setup-node + `npm ci`. Cada job faz `actions/checkout` como primeiro passo antes de invocar a composite action.

**Rationale:** Mantém baixo acoplamento entre jobs (cada um chama `uses: ./.github/actions/setup-node-deps`) sem duplicar os steps de setup/install. Se a versão de Node mudar ou o cache precisar de ajuste, altera-se em um lugar.

**Restrição técnica:** o GitHub só consegue resolver `uses: ./caminho` depois que a action está em disco. Isso obriga o checkout a ficar no job (antes da invocação da composite), não dentro da action. O trade-off é repetir uma linha por job, mas isso permite também que cada job controle parâmetros específicos do checkout (ex.: `coverage-sonar` usa `fetch-depth: 0` para o SonarCloud).

**Alternativa:** reusable workflow (`workflow_call`). Mais pesado para algo tão simples; composite actions são a ferramenta idiomática para este caso.

### Decisão 3: Rodar testes no CI com Vitest direto vs. `docker-compose.test.yml`
**Escolhido:** `npx vitest run` direto no runner do GitHub, sem docker compose.

**Rationale:** O `docker-compose.test.yml` existe para isolar o ambiente local (dev roda em Docker por convenção do projeto). No CI, o runner já é efêmero e isolado; subir Docker-in-Docker para testes adiciona latência e complexidade. Os testes usam `testcontainers` (Postgres), que funciona nativamente no runner GitHub-hosted porque o Docker daemon está disponível. O `package.json` já expõe `test:vitest` e `test:coverage` exatamente para esse caso.

**Alternativa:** rodar `npm run test` (compose). Descartado — levaria a Docker-in-Docker desnecessário no CI.

### Decisão 4: Thresholds de cobertura em código (`vitest.config.ts`) vs. UI do SonarCloud
**Escolhido:** em `vitest.config.ts` sob `coverage.thresholds`.

**Rationale:** Alinhado com o pedido de "qualidade dentro do código, regras desacopladas". Threshold no código é versionado, revisado em PR e falha localmente também. SonarCloud continua fazendo análise qualitativa (code smells, duplicações), mas o gate numérico de cobertura é responsabilidade do Vitest. Valor inicial: `lines: 80, functions: 80, branches: 75, statements: 80` (ajustável conforme o projeto amadurece).

### Decisão 5: Branch Protection via `gh` CLI script vs. Terraform
**Escolhido:** `scripts/branch-protection.sh` chamando `gh api PUT /repos/:owner/:repo/branches/master/protection`.

**Rationale:** Já pedido pelo usuário; `gh` CLI já está assumido no workflow do dev (o projeto usa `gh` para criar PRs). Sem novas dependências. Script é idempotente (PUT replaces). Para versionar o conteúdo, o JSON vai inline no script (heredoc), revisável em diff.

**Required status checks (branch protection):**
- `ci / lint`
- `ci / typecheck`
- `ci / test`
- `ci / coverage-sonar`
- `ci / build`

Além disso: `required_pull_request_reviews.required_approving_review_count = 1`, `dismiss_stale_reviews = true`, `required_linear_history = true`, `enforce_admins = false` (permite hotfix em emergência).

### Decisão 6: Consolidar SonarCloud no job de cobertura vs. manter workflow separado
**Escolhido:** consolidar em `coverage-sonar` dentro de `ci.yml`; remover `sonarcloud.yml`.

**Rationale:** Cobertura e Sonar compartilham o mesmo `npm run test:coverage`. Mantê-los separados forçaria dois `npm ci` e dois `test:coverage`, duplicando tempo de CI. O status check passa a ser `ci / coverage-sonar` — impacto documentado como breaking no proposal.

## Risks / Trade-offs

- **Risco:** Testes no runner GitHub-hosted podem ficar mais lentos que o docker compose local por causa do cold start do testcontainers. → **Mitigação:** cache do `node_modules` via `actions/setup-node cache: npm`; `testcontainers` reutiliza imagens Postgres via cache do Docker do runner. Se ficar lento, migrar para `services: postgres` do GH Actions.
- **Risco:** Script de Branch Protection roda localmente por admin — pode sair de sincronia com o workflow se alguém adicionar um job novo e esquecer de atualizar os `required_status_checks`. → **Mitigação:** `docs/ci.md` documenta o procedimento; adicionar uma task "se você adicionar um job, atualize o script" no `CONTRIBUTING` futuro. Workflow dispatch do script (futuro) pode automatizar.
- **Risco:** Thresholds de cobertura muito altos no início podem bloquear PRs em áreas do código legado. → **Mitigação:** começar com valores compatíveis com a cobertura atual (medir antes de definir o número final na implementação); elevar gradualmente.
- **Risco:** Remoção do workflow `sonarcloud.yml` altera o nome do status check obrigatório — se Branch Protection já estivesse ativa (não está), quebraria merges. → **Mitigação:** Branch Protection é criada junto, já apontando para o novo nome.
- **Trade-off:** Jobs paralelos consomem mais minutos de CI (5 jobs × setup) do que um único job monolítico. Aceitável pelo ganho em feedback rápido e isolamento de falhas; o cache do `npm ci` mantém o overhead em poucos segundos por job.

## Migration Plan

1. Implementar composite action e `ci.yml` em PR (roda em paralelo com o `sonarcloud.yml` existente — não quebra nada).
2. Validar que todos os jobs passam no próprio PR.
3. Remover `sonarcloud.yml` no mesmo PR.
4. Mergear.
5. Admin roda `scripts/branch-protection.sh` para aplicar as regras na `master`.
6. **Rollback:** reverter o commit; `gh api DELETE /repos/.../branches/master/protection` remove a proteção se necessário.

## Open Questions

- Valor inicial exato dos thresholds de cobertura — será definido na task de implementação após medir a cobertura atual com `npm run test:coverage`.
- Queremos `CODEOWNERS` obrigatório no Branch Protection? Pode ser adicionado em mudança futura; fora do escopo aqui.

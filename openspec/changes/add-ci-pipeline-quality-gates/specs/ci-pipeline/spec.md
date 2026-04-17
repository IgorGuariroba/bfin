## ADDED Requirements

### Requirement: Workflow unificado de CI
O projeto SHALL ter um único workflow GitHub Actions em `.github/workflows/ci.yml` que executa os gates de qualidade em PRs para `master` e pushes em `master`.

#### Scenario: Trigger em Pull Request
- **WHEN** um Pull Request é aberto, sincronizado ou reaberto com destino na branch `master`
- **THEN** o workflow `ci` dispara e executa todos os jobs definidos

#### Scenario: Trigger em push para master
- **WHEN** um commit é empurrado diretamente para `master` (merge de PR)
- **THEN** o workflow `ci` dispara e executa todos os jobs definidos

### Requirement: Jobs desacoplados e paralelos
O workflow `ci.yml` SHALL declarar jobs independentes que executam em paralelo e não compartilham estado: `lint`, `typecheck`, `test`, `coverage-sonar`, `build`.

#### Scenario: Execução paralela
- **WHEN** o workflow `ci` dispara
- **THEN** os jobs `lint`, `typecheck`, `test`, `coverage-sonar` e `build` iniciam simultaneamente, cada um em seu próprio runner, sem `needs:` entre eles

#### Scenario: Falha isolada de um job
- **WHEN** o job `lint` falha
- **THEN** os jobs `typecheck`, `test`, `coverage-sonar` e `build` continuam sua execução independentemente e reportam seu resultado individual

### Requirement: Composite action de setup compartilhada
O repositório SHALL fornecer uma composite action local em `.github/actions/setup-node-deps/action.yml` que encapsula checkout, configuração de Node 22 com cache npm e instalação de dependências via `npm ci`.

#### Scenario: Reutilização por todos os jobs
- **WHEN** um job do `ci.yml` precisa preparar o ambiente Node
- **THEN** ele usa `uses: ./.github/actions/setup-node-deps` em vez de duplicar os steps de checkout/setup/install

#### Scenario: Alteração centralizada
- **WHEN** a versão do Node precisa ser atualizada
- **THEN** a mudança é feita apenas em `.github/actions/setup-node-deps/action.yml` e propaga para todos os jobs automaticamente

### Requirement: Job lint
O job `lint` SHALL executar `npm run lint` e falhar caso o ESLint reporte erros.

#### Scenario: Código com erro de lint
- **WHEN** o PR contém código que viola as regras do ESLint
- **THEN** o job `lint` falha com exit code não-zero e o status check `ci / lint` fica vermelho

### Requirement: Job typecheck
O job `typecheck` SHALL executar o compilador TypeScript em modo `--noEmit` via `npm run build -- --noEmit` ou equivalente e falhar em erros de tipo.

#### Scenario: Código com erro de tipagem
- **WHEN** o PR contém código com erro de tipo TypeScript
- **THEN** o job `typecheck` falha e o status check `ci / typecheck` fica vermelho

### Requirement: Job test
O job `test` SHALL executar `npx vitest run` diretamente no runner do GitHub Actions (sem docker compose), aproveitando suporte nativo a Docker para testcontainers.

#### Scenario: Testes passam
- **WHEN** todos os testes Vitest passam
- **THEN** o job `test` retorna sucesso e o status check `ci / test` fica verde

#### Scenario: Teste falha
- **WHEN** um teste Vitest falha
- **THEN** o job `test` retorna exit code não-zero com o output do Vitest visível nos logs do Action

### Requirement: Job coverage-sonar
O job `coverage-sonar` SHALL executar `npm run test:coverage` e submeter o relatório LCOV gerado à análise SonarCloud na mesma execução.

#### Scenario: Cobertura acima do threshold
- **WHEN** a cobertura gerada satisfaz os thresholds configurados em `vitest.config.ts`
- **THEN** o job `coverage-sonar` executa `SonarSource/sonarcloud-github-action` e reporta sucesso

#### Scenario: Cobertura abaixo do threshold
- **WHEN** a cobertura está abaixo do threshold definido em `vitest.config.ts`
- **THEN** o `vitest run --coverage` falha antes mesmo do scan do Sonar, e o job `coverage-sonar` fica vermelho

### Requirement: Job build
O job `build` SHALL executar `npm run build` (`tsc`) e falhar se o TypeScript não compilar o projeto para `dist/`.

#### Scenario: Build bem-sucedido
- **WHEN** o código compila sem erros
- **THEN** o job `build` retorna sucesso

#### Scenario: Falha de compilação
- **WHEN** o TypeScript retorna erro de compilação
- **THEN** o job `build` falha e o status check `ci / build` fica vermelho

### Requirement: Thresholds de cobertura no código
O arquivo `vitest.config.ts` SHALL declarar `coverage.thresholds` que o `test:coverage` aplica localmente e no CI, de forma que a regra de cobertura fique versionada no repositório.

#### Scenario: Threshold aplicado localmente
- **WHEN** um desenvolvedor executa `npm run test:coverage` localmente
- **THEN** a execução falha se a cobertura cair abaixo do threshold definido em `vitest.config.ts`, com a mesma semântica do CI

#### Scenario: Alteração de threshold é revisada
- **WHEN** alguém modifica o threshold de cobertura
- **THEN** a mudança aparece no diff do PR e está sujeita a review, sem depender de configuração externa em UI

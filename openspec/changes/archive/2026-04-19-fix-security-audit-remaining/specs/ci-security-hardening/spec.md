# ci-security-hardening Specification

## Purpose

Defina hardening do pipeline CI/CD para mitigar riscos de supply chain, execução arbitrária e consumo excessivo de recursos.

## ADDED Requirements

### Requirement: Actions de terceiros fixadas por SHA
O workflow CI/CD SHALL referenciar todas as actions de terceiros pelo commit SHA completo, não por tag mutável (ex.: `@v4`, `@master`). Cada SHA SHALL ser acompanhado de um comentário indicando a versão semântica correspondente.

#### Scenario: Workflow usa SHA fixo
- **WHEN** o workflow `.github/workflows/ci.yml` é analisado
- **THEN** todas as actions de terceiros usam referência por SHA completo (40 caracteres hexadecimais) e não por tag

#### Scenario: Comentário de versão presente
- **WHEN** um desenvolvedor lê o workflow
- **THEN** cada action fixada por SHA possui um comentário na mesma linha indicando a versão semântica legível (ex.: `# v4.1.1`)

### Requirement: Permissões mínimas do GITHUB_TOKEN
O workflow CI/CD SHALL definir `permissions: contents: read` no nível global (`jobs` não declarados explicitamente herdam o mínimo). Jobs que requerem permissões adicionais SHALL declará-las explicitamente no nível do job.

#### Scenario: Token com permissões mínimas por padrão
- **WHEN** o workflow é executado para lint, typecheck, test ou build
- **THEN** o `GITHUB_TOKEN` possui apenas `contents: read`

#### Scenario: Job com permissões extras declaradas explicitamente
- **WHEN** o job `coverage-sonar` requer `pull-requests: write` para publicar comentários do SonarCloud
- **THEN** essa permissão é declarada apenas no escopo desse job, não no workflow inteiro

### Requirement: Timeout em todos os jobs
Cada job no workflow CI/CD SHALL definir `timeout-minutes` com um valor adequado ao tempo esperado de execução.

#### Scenario: Job com timeout definido
- **WHEN** qualquer job do workflow é executado
- **THEN** o job possui `timeout-minutes` definido e é cancelado automaticamente se exceder o tempo

#### Scenario: Timeout adequado ao job
- **WHEN** o job `test` executa a suíte completa
- **THEN** o timeout é de no máximo 15 minutos, suficiente para a suíte atual

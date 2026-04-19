## MODIFIED Requirements

### Requirement: Pipeline GitHub Actions para SonarCloud
O projeto SHALL executar a análise SonarCloud como um job (`coverage-sonar`) dentro do workflow unificado `.github/workflows/ci.yml`, em cada PR para `master` e em cada push para `master`. O workflow dedicado anterior (`.github/workflows/sonarcloud.yml`) é removido.

#### Scenario: Análise em PR
- **WHEN** um PR é aberto contra a branch `master`
- **THEN** o job `coverage-sonar` de `ci.yml` executa `npm run test:coverage` e em seguida roda `SonarSource/sonarcloud-github-action` no mesmo runner, reutilizando o relatório LCOV

#### Scenario: Análise em push no master
- **WHEN** um push é feito no branch `master`
- **THEN** o job `coverage-sonar` executa e atualiza o dashboard do SonarCloud

#### Scenario: Status check exposto
- **WHEN** o job executa
- **THEN** ele aparece no Checks tab do PR com o nome `ci / coverage-sonar` e é um dos required status checks configurados em Branch Protection

### Requirement: Coverage report integrado ao scan
O job `coverage-sonar` SHALL gerar o relatório LCOV com `npm run test:coverage` e enviá-lo ao SonarCloud dentro da mesma execução, sem depender de upload de artefatos entre jobs.

#### Scenario: Coverage disponível no scan
- **WHEN** o job `coverage-sonar` executa
- **THEN** o arquivo `coverage/lcov/lcov.info` é gerado no workspace do runner e o step subsequente do SonarCloud Scan o lê diretamente, com a cobertura aparecendo no dashboard

#### Scenario: Threshold de cobertura falha antes do scan
- **WHEN** a cobertura gerada está abaixo do threshold declarado em `vitest.config.ts`
- **THEN** `npm run test:coverage` retorna exit code não-zero e o step do SonarCloud Scan não é executado, fazendo o job falhar com a causa clara

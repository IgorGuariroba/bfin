## ADDED Requirements

### Requirement: sonar-project.properties
O projeto SHALL ter um arquivo `sonar-project.properties` na raiz com a configuração do SonarCloud.

#### Scenario: Arquivo de configuração existe
- **WHEN** o projeto é clonado
- **THEN** o arquivo `sonar-project.properties` existe na raiz com projectKey, organization, sources (`src`), e exclusões (`dist/**,node_modules/**,drizzle/**,tests/**`)

### Requirement: Coverage em formato LCOV
O Vitest SHALL gerar relatórios de cobertura no formato LCOV para consumo do SonarCloud.

#### Scenario: Script de coverage
- **WHEN** `npm run test:coverage` é executado
- **THEN** o Vitest gera relatórios em `coverage/lcov/` no formato LCOV usando `@vitest/coverage-istanbul`

### Requirement: Pipeline GitHub Actions para SonarCloud
O projeto SHALL ter um workflow GitHub Actions que executa análise SonarCloud em cada PR e push no master.

#### Scenario: Análise em PR
- **WHEN** um PR é aberto contra o branch master
- **THEN** o workflow executa testes com coverage e depois roda o SonarCloud Scan

#### Scenario: Análise em push no master
- **WHEN** um push é feito no branch master
- **THEN** o workflow executa análise SonarCloud e atualiza o dashboard

### Requirement: SONAR_TOKEN como secret
O pipeline SHALL usar `SONAR_TOKEN` armazenado como GitHub Secret para autenticação com o SonarCloud.

#### Scenario: Token configurado
- **WHEN** o workflow executa
- **THEN** a action `SonarSource/sonarcloud-github-action` usa `${{ secrets.SONAR_TOKEN }}` para autenticação

### Requirement: Coverage report integrado ao scan
O pipeline SHALL enviar o coverage report ao SonarCloud como parte da análise.

#### Scenario: Coverage disponível no scan
- **WHEN** o SonarCloud scan executa
- **THEN** o relatório LCOV em `coverage/lcov/lcov.info` é enviado e a cobertura de testes aparece no dashboard

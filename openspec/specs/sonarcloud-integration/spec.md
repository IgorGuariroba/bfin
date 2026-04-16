## Purpose

Integracao do projeto com o SonarCloud para analise continua de qualidade de codigo e cobertura de testes.

## Requirements

### Requirement: sonar-project.properties
O projeto SHALL ter um arquivo `sonar-project.properties` na raiz com a configuracao do SonarCloud.

#### Scenario: Arquivo de configuracao existe
- **WHEN** o projeto e clonado
- **THEN** o arquivo `sonar-project.properties` existe na raiz com projectKey, organization, sources (`src`), e exclusoes (`dist/**,node_modules/**,drizzle/**,tests/**`)

### Requirement: Coverage em formato LCOV
O Vitest SHALL gerar relatorios de cobertura no formato LCOV para consumo do SonarCloud.

#### Scenario: Script de coverage
- **WHEN** `npm run test:coverage` e executado
- **THEN** o Vitest gera relatorios em `coverage/lcov/` no formato LCOV usando `@vitest/coverage-istanbul`

### Requirement: Pipeline GitHub Actions para SonarCloud
O projeto SHALL ter um workflow GitHub Actions que executa analise SonarCloud em cada PR e push no master.

#### Scenario: Analise em PR
- **WHEN** um PR e aberto contra o branch master
- **THEN** o workflow executa testes com coverage e depois roda o SonarCloud Scan

#### Scenario: Analise em push no master
- **WHEN** um push e feito no branch master
- **THEN** o workflow executa analise SonarCloud e atualiza o dashboard

### Requirement: SONAR_TOKEN como secret
O pipeline SHALL usar `SONAR_TOKEN` armazenado como GitHub Secret para autenticacao com o SonarCloud.

#### Scenario: Token configurado
- **WHEN** o workflow executa
- **THEN** a action `SonarSource/sonarcloud-github-action` usa `${{ secrets.SONAR_TOKEN }}` para autenticacao

### Requirement: Coverage report integrado ao scan
O pipeline SHALL enviar o coverage report ao SonarCloud como parte da analise.

#### Scenario: Coverage disponivel no scan
- **WHEN** o SonarCloud scan executa
- **THEN** o relatorio LCOV em `coverage/lcov/lcov.info` e enviado e a cobertura de testes aparece no dashboard

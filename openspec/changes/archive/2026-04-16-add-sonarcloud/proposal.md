## Why

O projeto já usa `eslint-plugin-sonarjs` para detecção local de bugs, mas não possui análise contínua de qualidade de código nem cobertura de testes reportada. Uma integração com SonarCloud permitiria tracking de quality gate, cobertura de testes, duplicação de código, vulnerabilidades e technical debt em cada PR e no branch principal.

## What Changes

- Adicionar arquivo `sonar-project.properties` na raiz com configuração do projeto (projectKey, sources, exclusions)
- Adicionar step de análise SonarCloud no pipeline de CI (GitHub Actions)
- Configurar coverage reports do Vitest para formato compatível com SonarCloud (cobertura ISTANBUL/LCOV)
- Configurar quality gate mínimo (cobertura, duplicação, bugs, vulnerabilities)

## Capabilities

### New Capabilities
- `sonarcloud-integration`: Configuração do SonarCloud com sonar-project.properties, pipeline CI, e geração de coverage reports

### Modified Capabilities
- `eslint-config`: Adicionar geração de relatório ESLint no formato compatível com SonarCloud (JSON) para importação externa

## Impact

- Novos arquivos: `sonar-project.properties`, `.github/workflows/sonarcloud.yml`
- Modificação em `package.json`: ajuste no script de teste para gerar coverage em formato LCOV
- Modificação em `vitest.config.ts` (ou criação): configuração de coverage provider
- Dependência: SonarCloud organization/project precisa existir no sonarcloud.io
- Secrets necessários: `SONAR_TOKEN` no repositório GitHub

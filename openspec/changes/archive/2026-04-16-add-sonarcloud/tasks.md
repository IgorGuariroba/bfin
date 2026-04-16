## 1. Coverage com Vitest

- [x] 1.1 Instalar `@vitest/coverage-istanbul` como devDependency
- [x] 1.2 Adicionar script `test:coverage` no `package.json` que roda `vitest run --coverage`
- [x] 1.3 Adicionar configuração de coverage no `vitest.config.ts` com provider `istanbul` e reports `["lcov"]`
- [x] 1.4 Adicionar `coverage/` ao `.gitignore`

## 2. Configuração do SonarCloud

- [x] 2.1 Criar `sonar-project.properties` na raiz com projectKey, organization, sources, test exclusions e coverage path
- [x] 2.2 Adicionar `sonar.javascript.lcov.reportPaths=coverage/lcov/lcov.info` ao sonar-project.properties

## 3. Pipeline GitHub Actions

- [x] 3.1 Criar `.github/workflows/sonarcloud.yml` com trigger para PRs contra master e pushes no master
- [x] 3.2 Configurar step de checkout com `fetch-depth: 0` (necessário para blame do SonarCloud)
- [x] 3.3 Configurar step de setup Node.js
- [x] 3.4 Configurar step de install de dependências
- [x] 3.5 Configurar step de geração de coverage (`npm run test:coverage`)
- [x] 3.6 Configurar step de SonarCloud Scan usando action oficial `SonarSource/sonarcloud-github-action`
- [x] 3.7 Configurar variável de ambiente `SONAR_TOKEN` via `${{ secrets.SONAR_TOKEN }}`
- [x] 3.8 Configurar variável de ambiente `GITHUB_TOKEN` via `${{ secrets.GITHUB_TOKEN }}`

## 4. Verificação

- [x] 4.1 Executar `npm run test:coverage` localmente e verificar que `coverage/lcov/lcov.info` é gerado
- [x] 4.2 Verificar que `sonar-project.properties` está sintaticamente correto
- [x] 4.3 Verificar que o workflow YAML é válido

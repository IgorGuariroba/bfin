## MODIFIED Requirements

### Requirement: Scripts de lint
O `package.json` SHALL conter scripts `lint`, `lint:fix`, e `test:coverage`.

#### Scenario: Script lint
- **WHEN** `npm run lint` é executado
- **THEN** o ESLint analisa todos os arquivos `src/**/*.ts` e reporta erros/warnings

#### Scenario: Script lint:fix
- **WHEN** `npm run lint:fix` é executado
- **THEN** o ESLint corrige automaticamente os problemas que podem ser auto-corrigidos

#### Scenario: Script test:coverage
- **WHEN** `npm run test:coverage` é executado
- **THEN** o Vitest executa os testes com coverage habilitado e gera relatório LCOV em `coverage/lcov/`

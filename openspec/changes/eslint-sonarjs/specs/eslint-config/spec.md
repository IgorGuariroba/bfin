## ADDED Requirements

### Requirement: Flat config do ESLint
O projeto SHALL ter um arquivo `eslint.config.js` na raiz utilizando o formato flat config do ESLint 9.

#### Scenario: Arquivo de configuração existe
- **WHEN** o projeto é clonado
- **THEN** o arquivo `eslint.config.js` existe na raiz com configuração válida para TypeScript

### Requirement: Parser e plugin TypeScript
A configuração SHALL usar `typescript-eslint` com parser e plugin habilitados para todos os arquivos `.ts`.

#### Scenario: Análise de arquivos TypeScript
- **WHEN** `npm run lint` é executado
- **THEN** todos os arquivos `.ts` em `src/` são analisados com regras TypeScript

### Requirement: Regras SonarJS de bugs
A configuração SHALL integrar `eslint-plugin-sonarjs` habilitando as regras `recommended` (bugs).

#### Scenario: Detecção de código morto
- **WHEN** o código contém uma ramificação `if/else` onde a condição é sempre verdadeira
- **THEN** o lint reporta erro `sonarjs/no-one-iteration-loop` ou regra equivalente

#### Scenario: Detecção de duplicação em switch
- **WHEN** dois cases de um switch possuem o mesmo código
- **THEN** o lint reporta erro `sonarjs/no-duplicated-branches`

### Requirement: Scripts de lint
O `package.json` SHALL conter scripts `lint` e `lint:fix`.

#### Scenario: Script lint
- **WHEN** `npm run lint` é executado
- **THEN** o ESLint analisa todos os arquivos `src/**/*.ts` e reporta erros/warnings

#### Scenario: Script lint:fix
- **WHEN** `npm run lint:fix` é executado
- **THEN** o ESLint corrige automaticamente os problemas que podem ser auto-corrigidos

### Requirement: Ignore de arquivos gerados
A configuração SHALL ignorar `dist/`, `node_modules/` e `drizzle/` da análise.

#### Scenario: Arquivos ignorados
- **WHEN** `npm run lint` é executado
- **THEN** nenhum arquivo em `dist/`, `node_modules/` ou `drizzle/` é analisado

### Requirement: Zero erros no código existente
Após a configuração, `npm run lint` SHALL retornar zero erros (exit code 0) no código atual.

#### Scenario: Código existente limpo
- **WHEN** `npm run lint` é executado no estado atual do projeto
- **THEN** o comando termina com exit code 0 (erros = 0, warnings podem existir)

### Requirement: Integração com CI
O pipeline de testes (`docker-compose.test.yml`) SHALL executar o lint antes dos testes.

#### Scenario: Lint no CI
- **WHEN** `npm run test` é executado via docker-compose
- **THEN** o lint é executado e falha o build se houver erros

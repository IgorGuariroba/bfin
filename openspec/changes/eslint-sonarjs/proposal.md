## Why

O projeto não possui linter estático configurado. Sem análise estática, bugs recorrentes (código morto, condições sempre verdadeiras/falsas, variáveis não utilizadas, comparações com `==` em vez de `===`) passam despercebidos até revisão manual ou execução. O ESLint com o plugin `eslint-plugin-sonarjs` traz regras de qualidade baseadas no Sonar que capturam essas categorias de defeitos automaticamente.

## What Changes

- Adicionar ESLint 9 com configuração flat config (`eslint.config.js`)
- Integrar `@typescript-eslint/parser` e `@typescript-eslint/eslint-plugin` para análise TypeScript
- Integrar `eslint-plugin-sonarjs` com regras de bugs e code smell
- Adicionar script `lint` e `lint:fix` ao `package.json`
- Integrar lint no fluxo de CI via `docker-compose.test.yml`

## Capabilities

### New Capabilities
- `eslint-config`: Configuração do ESLint com TypeScript e SonarJS para análise estática do código

### Modified Capabilities
<!-- Nenhuma spec existente tem requisitos alterados -->

## Impact

- **Dependências**: Novos devDependencies (`eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-sonarjs`, `typescript-eslint`)
- **Scripts**: Novos scripts `lint` e `lint:fix` no `package.json`
- **CI**: Etapa de lint adicionada ao pipeline de testes
- **DX**: Desenvolvedores passam a receber feedback imediato de qualidade via `npm run lint`

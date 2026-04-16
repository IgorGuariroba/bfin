## 1. Instalar dependências

- [x] 1.1 Adicionar `eslint`, `typescript-eslint` e `eslint-plugin-sonarjs` como devDependencies

## 2. Configurar ESLint

- [x] 2.1 Criar `eslint.config.js` na raiz com flat config, parser TypeScript e plugin SonarJS recommended
- [x] 2.2 Configurar ignores para `dist/`, `node_modules/` e `drizzle/`

## 3. Scripts e CI

- [x] 3.1 Adicionar scripts `lint` e `lint:fix` ao `package.json`
- [x] 3.2 Adicionar etapa de lint ao `docker-compose.test.yml` antes dos testes

## 4. Validar

- [x] 4.1 Executar `npm run lint` e garantir zero erros (ajustar config ou código se necessário)

## 1. Instalar dependências

- [x] 1.1 Adicionar `eslint`, `typescript-eslint` e `eslint-plugin-sonarjs` como devDependencies

## 2. Configurar ESLint

- [ ] 2.1 Criar `eslint.config.js` na raiz com flat config, parser TypeScript e plugin SonarJS recommended
- [ ] 2.2 Configurar ignores para `dist/`, `node_modules/` e `drizzle/`

## 3. Scripts e CI

- [ ] 3.1 Adicionar scripts `lint` e `lint:fix` ao `package.json`
- [ ] 3.2 Adicionar etapa de lint ao `docker-compose.test.yml` antes dos testes

## 4. Validar

- [ ] 4.1 Executar `npm run lint` e garantir zero erros (ajustar config ou código se necessário)

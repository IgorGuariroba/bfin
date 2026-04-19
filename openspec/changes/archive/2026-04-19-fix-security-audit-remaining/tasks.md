## 1. Corrigir SQL Injection em category-service.ts

- [x] 1.1 Substituir `sql.raw` em `assertNoVinculos` por queries parametrizadas do Drizzle ORM (`db.select().from().where()`)
- [x] 1.2 Verificar que `categoriaId` é passado como parâmetro, não concatenado no SQL
- [x] 1.3 Criar testes de segurança (`tests/category-service-security.test.ts`) validando que IDs maliciosos não executam SQL arbitrário
- [x] 1.4 Rodar `npm run lint` e `npm run typecheck` para validar
- [x] 1.5 Rodar `npm run test` para garantir que a lógica de deleção de categorias continua funcionando

## 2. Hardening do pipeline CI/CD

- [ ] 2.1 Fixar `actions/checkout@v4` por SHA com comentário de versão em `.github/workflows/ci.yml`
- [ ] 2.2 Fixar `actions/setup-node@v4` por SHA com comentário em `.github/actions/setup-node-deps/action.yml`
- [ ] 2.3 Fixar `SonarSource/sonarcloud-github-action@master` por SHA com comentário em `.github/workflows/ci.yml`
- [ ] 2.4 Adicionar `permissions: contents: read` no topo do workflow `.github/workflows/ci.yml`
- [ ] 2.5 Adicionar `permissions: pull-requests: write` no job `coverage-sonar` se necessário para SonarCloud
- [ ] 2.6 Adicionar `timeout-minutes` em todos os jobs do workflow (lint, typecheck, test, coverage-sonar, build)

## 3. Validação final

- [x] 3.1 Rodar `npm run lint` e `npm run typecheck` localmente
- [x] 3.2 Rodar `npm run test` para garantir que nenhum teste quebrou
- [ ] 3.3 Verificar se o CI passa em um push de teste (opcional)

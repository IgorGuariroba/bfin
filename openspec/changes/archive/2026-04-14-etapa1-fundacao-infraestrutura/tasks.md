## 1. Inicialização do projeto

- [x] 1.1 Inicializar projeto com `npm init` e configurar `package.json` com scripts: `dev`, `build`, `start`, `test`, `db:generate`, `db:migrate`
- [x] 1.2 Instalar dependências: `fastify`, `drizzle-orm`, `postgres` (driver pg), `pino`, e devDependencies: `typescript`, `tsx`, `drizzle-kit`, `vitest`, `testcontainers`, `@types/node`
- [x] 1.3 Configurar `tsconfig.json` com target ES2022, moduleResolution bundler, strict mode
- [x] 1.4 Criar estrutura de diretórios: `src/db/`, `src/plugins/`, `src/lib/`, `src/routes/`, `src/db/migrations/`

## 2. Configuração e bootstrap

- [x] 2.1 Criar `src/config.ts` com leitura de variáveis de ambiente (`PORT`, `DATABASE_URL`, `NODE_ENV`) com validação no bootstrap
- [x] 2.2 Criar `src/db/index.ts` com conexão Drizzle ORM ao PostgreSQL usando `DATABASE_URL`
- [x] 2.3 Criar `src/db/schema.ts` com schema base (vazio, preparado para entidades futuras)
- [x] 2.4 Criar `drizzle.config.ts` com configuração do Drizzle Kit para migrations

## 3. Servidor Fastify

- [x] 3.1 Criar `src/app.ts` com factory function que configura Fastify com Pino logger integrado
- [x] 3.2 Criar `src/server.ts` com bootstrap do servidor (listen na porta configurada)
- [x] 3.3 Criar `src/routes/health.ts` com rota `GET /health` retornando `{ "status": "ok" }`

## 4. RequestId

- [x] 4.1 Criar `src/plugins/request-id.ts` como plugin Fastify que usa `genReqId` para gerar IDs no formato `req-<uuid>`, respeitando header `X-Request-Id` quando presente
- [x] 4.2 Registrar o plugin no `app.ts` e verificar propagação do `reqId` nos logs Pino

## 5. Error handling

- [x] 5.1 Criar `src/lib/errors.ts` com classes de erro: `AppError` (base), `BusinessRuleError` (422), `NotFoundError` (404), `ForbiddenError` (403), `DuplicateError` (409/422) — cada uma com `statusCode` e `code`
- [x] 5.2 Criar `src/lib/error-handler.ts` com `setErrorHandler` global que converte exceções no formato padronizado `{ timestamp, requestId, message, code }`, incluindo tratamento de erros de validação Fastify (400) e erros inesperados (500)
- [x] 5.3 Registrar o error handler no `app.ts`

## 6. Docker

- [x] 6.1 Criar `Dockerfile` multi-stage: estágio build (npm ci + tsc) e estágio runtime (node:22-alpine com dist/ e node_modules de produção)
- [x] 6.2 Criar `docker-compose.yml` com serviços `api` (porta 3000) e `db` (PostgreSQL 16-alpine com volume `pgdata`), variáveis de ambiente configuradas
- [x] 6.3 Criar `.dockerignore` para excluir node_modules, dist, .git, etc.
- [x] 6.4 Adicionar `USER node` no estágio runtime do `Dockerfile` antes do `CMD`
- [x] 6.5 Migrar variáveis hardcoded do `docker-compose.yml` para `env_file: .env` e criar `.env.example` versionado
- [x] 6.6 Remover publicação da porta `5432` do serviço `db` e restringir bind da API para `127.0.0.1:3000:3000`
- [x] 6.7 Adicionar `healthcheck` (`pg_isready`) no `db` e `depends_on: condition: service_healthy` no `api`
- [x] 6.8 Adicionar `restart: unless-stopped`, `mem_limit` e `cpus` em ambos os serviços

## 7. Testes de integração

- [x] 7.1 Criar `tests/helpers/setup.ts` com helper `createTestApp()` que sobe instância Fastify configurada para testes com banco real via testcontainers
- [x] 7.2 Configurar `vitest.config.ts` com timeout adequado para testcontainers e paths de teste
- [x] 7.3 Implementar mecanismo de rollback transacional entre testes (transaction wrapper que reverte ao final de cada test)
- [x] 7.4 Criar `tests/health.test.ts` — teste de integração do endpoint `/health` para validar que a infraestrutura funciona end-to-end
- [x] 7.5 Criar `tests/error-handler.test.ts` — testes do error handler: erro de negócio, not found, erro inesperado, requestId no body de erro

## 8. Configuração final

- [x] 8.1 Criar `.gitignore` com regras para node_modules, dist, .env, .idea, etc.
- [x] 8.2 Verificar que `npm run dev` sobe o servidor com sucesso
- [x] 8.3 Verificar que `docker compose up` sobe API + banco com sucesso
- [x] 8.4 Verificar que `npm test` executa testes de integração com sucesso

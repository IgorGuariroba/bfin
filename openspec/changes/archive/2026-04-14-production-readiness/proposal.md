## Why

A infraestrutura atual (Fastify + Drizzle + Docker Compose) funciona bem em dev, mas não está pronta para operar em produção: o processo não trata `SIGTERM`, variáveis de ambiente não são validadas no boot, não há plugins de segurança (helmet, CORS, rate-limit), o `/health` não distingue liveness de readiness, migrations rodam manualmente, secrets ficam em `.env` texto puro e não há métricas expostas. Endereçar essas lacunas agora evita retrabalho quando o serviço for exposto a usuários reais e mantém o fluxo de dev simples.

## What Changes

- Graceful shutdown no `server.ts`: handlers para `SIGTERM`/`SIGINT` que fecham o Fastify e o pool do Postgres antes de sair
- Validação de env no boot com Zod em `src/config.ts`; falha explícita se faltar variável crítica
- Registro dos plugins `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit` com defaults seguros
- Separação da rota `/health` em `/health/live` (processo vivo) e `/health/ready` (checa Postgres via `SELECT 1`)
- Timeouts e `bodyLimit` explícitos na instância Fastify
- Pool Postgres com `max`, `idle_timeout`, `connect_timeout` tunados e retry/backoff no boot
- Migrations automáticas no startup em produção com `pg_advisory_lock` para evitar corrida
- `Dockerfile` com `HEALTHCHECK` apontando para `/health/live`
- Arquivo `docker-compose.prod.yml` (override) que: não publica a porta do Postgres, lê secrets de env externo (não de `.env` commitado), sobe atrás de reverse proxy
- Observabilidade: plugin `fastify-metrics` expondo `/metrics` (Prometheus). `reqId` já existente é preservado
- Política de logs: redact de campos sensíveis no Pino (authorization, cookie, password)
- `docs/deploy.md` curto descrevendo variáveis obrigatórias, passos de deploy e smoke tests
- **BREAKING**: rota `/health` passa a redirecionar para `/health/live` (ou é removida) — clientes devem migrar para `/health/live` ou `/health/ready`

## Capabilities

### New Capabilities
- `lifecycle`: inicialização validada, graceful shutdown e migrations controladas por lock
- `health`: endpoints `/health/live` e `/health/ready` com semânticas distintas
- `security-hardening`: helmet, CORS, rate-limit, body limits, timeouts e redact de logs
- `observability`: exposição de métricas Prometheus e logs estruturados sem PII
- `deploy`: compose de produção separado, Dockerfile com healthcheck e documentação de deploy

### Modified Capabilities
<!-- Nenhuma capability prévia existe em openspec/specs/ — tudo é novo. -->

## Impact

- **Código**: `src/server.ts`, `src/app.ts`, `src/config.ts`, `src/db/index.ts`, `src/routes/health.ts`, novos plugins em `src/plugins/`
- **Infra**: `Dockerfile` (adiciona HEALTHCHECK), novo `docker-compose.prod.yml`, `docker-compose.yml` atual fica dev-only
- **Dependências novas**: `zod`, `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, `fastify-metrics`
- **Testes**: novos testes de integração para `/health/ready` com DB indisponível, rate-limit e redact de logs
- **Docs**: `docs/deploy.md` novo
- **Operacional**: quem consome `/health` precisa migrar para os novos endpoints

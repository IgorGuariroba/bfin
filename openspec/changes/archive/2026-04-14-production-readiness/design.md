## Context

O bfin está na Etapa 1 (Fastify + Drizzle + Postgres + Docker Compose, testes de integração com Testcontainers). O foco até agora foi acelerar o desenvolvimento local. A aplicação ainda não tem usuários externos, mas queremos evitar acumular dívida operacional: decisões como "como tratar shutdown", "onde ficam secrets", "como separar liveness de readiness" e "como rodar migrations no deploy" são baratas de acertar agora e caras de reverter depois.

Restrições relevantes:
- Deve continuar simples rodar `docker compose up -d --build` em dev
- Postgres local permanece no compose dev; em produção o DB é gerenciado (RDS/Cloud SQL/Neon) — não resolvemos backup/replicação aqui
- Node 22 + ESM + TypeScript já estabelecidos
- Testes rodam com Testcontainers e devem continuar passando sem `docker compose up`

## Goals / Non-Goals

**Goals:**
- Deixar o processo resiliente a ciclos de deploy (graceful shutdown, readiness correta)
- Falhar rápido e claro quando configuração está inválida
- Defesa em profundidade em nível HTTP (helmet, CORS, rate-limit, body limits, timeouts)
- Separar superfície de `/health` para orquestradores (K8s-style liveness vs readiness)
- Migrations reprodutíveis e seguras em múltiplas réplicas
- Expor métricas mínimas sem introduzir um stack de observabilidade completo
- Manter `docker-compose.yml` atual como dev-only sem regressão

**Non-Goals:**
- Autenticação/autorização de usuário final (escopo de outra capability)
- Tracing distribuído (OpenTelemetry) — só métricas + logs
- Backup/replicação do Postgres
- CI/CD, scan de imagem, assinatura de artefatos
- Reverse proxy / TLS termination (assumimos que existe um proxy upstream em produção)

## Decisions

### 1. Validação de env com Zod em `src/config.ts`
Usar Zod em vez de Envalid porque já está no ecossistema TypeScript-first, dá tipos inferidos e mensagens de erro boas. Falha no boot se `DATABASE_URL`, `PORT`, `NODE_ENV` estiverem ausentes/invalidos. Alternativa: validação manual — descartada por ser verbosa e propensa a drift.

### 2. Graceful shutdown via `app.close()` + fechamento do pool
Registrar handlers para `SIGTERM` e `SIGINT` em `src/server.ts`. Sequência: parar de aceitar novas conexões (`app.close()` — Fastify drena requests em voo), depois `client.end()` no pool `postgres-js`, depois `process.exit(0)`. Timeout de 10s para forçar saída. Alternativa: usar `close-with-grace` — descartada, o custo/benefício não compensa uma dep nova.

### 3. `/health/live` vs `/health/ready`
- `/health/live`: responde 200 fixo enquanto o processo existe. Usado pelo Docker `HEALTHCHECK` e por liveness probe. **Nunca** toca o DB.
- `/health/ready`: roda `SELECT 1` com timeout de 2s; retorna 503 se falhar. Usado por readiness probe e load balancer.
- `/health` fica como alias para `/health/live` por um ciclo, com deprecation header, e é removido em change futura. (Registrado como BREAKING no proposal.)

### 4. Plugins de segurança
- `@fastify/helmet` com defaults (CSP desativado — API não serve HTML)
- `@fastify/cors` configurável via env (`CORS_ORIGIN`, default fechado em produção)
- `@fastify/rate-limit` com limite global (100 req/min por IP) + possibilidade de override por rota
- `bodyLimit: 1_048_576` (1 MB) na instância Fastify; `connectionTimeout: 10_000`, `keepAliveTimeout: 5_000`

### 5. Pool Postgres e retry no boot
`postgres-js` com `max: 10, idle_timeout: 30, connect_timeout: 10`. No boot, o `server.ts` tenta `SELECT 1` com retry exponencial (até 30s) antes de `listen()`. Isso cobre o caso de o DB ainda estar subindo junto no compose. Alternativa: deixar o depends_on/healthcheck resolver — funciona no compose, mas em K8s precisaria de init container, então a lógica fica no app.

### 6. Migrations automáticas com advisory lock
Criar `src/db/migrate.ts` que roda `drizzle-orm/postgres-js/migrator` dentro de `pg_advisory_lock(<int>)`. Dois modos:
- Dev: migration sob demanda via `npm run db:migrate`
- Prod: `MIGRATE_ON_BOOT=true` faz o `server.ts` rodar antes do `listen()`. Com advisory lock, múltiplas réplicas subindo ao mesmo tempo não colidem — apenas uma aplica, as outras esperam o lock liberar e seguem.

Alternativa: job Kubernetes dedicado — mais limpo para squads maduros, mas adiciona operação. Começamos com on-boot e migramos para job quando houver CI/CD.

### 7. `docker-compose.prod.yml` como override
Arquivo separado lido via `docker compose -f docker-compose.yml -f docker-compose.prod.yml`. Diferenças:
- Remove `ports` do `db` (não publica)
- API não lê `.env` file; espera variáveis já no ambiente (injetadas pelo orquestrador/Doppler/Secrets Manager)
- Adiciona `deploy.restart_policy` e labels para o reverse proxy
- Dockerfile ganha `HEALTHCHECK CMD wget -q -O- http://127.0.0.1:3000/health/live || exit 1`

O `docker-compose.yml` atual **permanece funcionando standalone para dev**, sem quebrar o fluxo `docker compose up -d --build`.

### 8. Observabilidade: `fastify-metrics`
Plugin único expõe `/metrics` no formato Prometheus (default: RED metrics + event loop + heap). Métricas de DB ficam de fora por ora (drizzle não tem hook nativo). Tracing/OTel deixamos para depois — não queremos carregar um agente OTel agora.

### 9. Redact de logs
Configurar `logger.redact` do Pino para `authorization`, `cookie`, `set-cookie`, `req.headers.authorization`, `password`, `token`. Isso não remove todas as PII possíveis, mas cobre os vetores óbvios e documenta a política.

## Risks / Trade-offs

- **Migração on-boot pode bloquear o primeiro boot se o lock travar indefinidamente** → timeout de 60s no `pg_advisory_lock`; se estourar, o boot falha com erro claro em vez de ficar pendurado.
- **Rate-limit global pode barrar testes de carga internos** → configurável via env (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`), default pode ser relaxado por `NODE_ENV=test`.
- **Validação estrita de env pode quebrar ambientes legados** → ainda não há ambientes legados; ok ser estrito desde já.
- **Expor `/metrics` sem autenticação** → aceitável atrás de reverse proxy interno; documentar no `deploy.md` que o endpoint NÃO deve ser exposto publicamente.
- **BREAKING em `/health`** → impacto zero hoje (sem clientes externos); documentado no proposal.
- **`postgres-js` fecha conexões em `client.end()` mas o Drizzle não expõe o client diretamente** → `src/db/index.ts` exporta também o `client` para permitir fechamento explícito no shutdown.

## Migration Plan

1. Implementar mudanças em branch, feature por feature (ordem em `tasks.md`)
2. Rodar suíte de testes de integração existente + novos testes de `/health/ready`, rate-limit e shutdown
3. Smoke test local: `docker compose up -d --build` → `curl /health/live`, `/health/ready`, `/metrics`
4. Smoke test do compose de produção: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up` com envs mockadas
5. Documentar deploy em `docs/deploy.md`
6. Merge em `master`

**Rollback:** reverter o merge; o `.env` antigo continua compatível porque os nomes de variáveis novas têm defaults ou são opcionais (exceto `DATABASE_URL` que já era obrigatório).

## Open Questions

- Qual o gerenciador de secrets alvo? (Doppler, AWS Secrets Manager, Vault?) — afeta só a documentação, não o código. Resolver antes de escrever `deploy.md`.
- Vamos precisar de `/metrics` autenticado em algum momento? Por ora: não; revisar quando expusermos publicamente.

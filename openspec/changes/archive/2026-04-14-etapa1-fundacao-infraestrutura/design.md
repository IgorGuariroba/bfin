## Context

Projeto greenfield — repositório vazio. A Financial Assistant API é um motor de previsão financeira para contas compartilhadas, conforme definido no plano.md. Esta é a Etapa 1: montar a fundação sobre a qual todas as features de negócio serão construídas.

Stack definida no plano: Node.js + Fastify + Drizzle ORM + PostgreSQL + Pino + Docker. Linguagem: TypeScript.

## Goals / Non-Goals

**Goals:**
- Projeto funcional com `npm run dev` que sobe um servidor Fastify respondendo em health check
- Docker Compose funcional com `docker compose up` que sobe API + PostgreSQL
- Toda request gera um `requestId` propagado nos logs Pino
- Erros da API seguem estrutura padronizada com códigos de negócio
- Testes de integração rodam contra PostgreSQL real sem mocks
- Drizzle ORM configurado com migrations e conexão ao PostgreSQL

**Non-Goals:**
- Autenticação/OIDC (Etapa 2)
- Rotas de negócio (Categorias, Contas, Movimentações — etapas futuras)
- PM2 e Cluster Mode (configuração de produção, etapa posterior)
- CI/CD pipeline
- Clinic.js (diagnóstico de performance)

## Decisions

### 1. Estrutura de diretórios — camadas flat

```
src/
  server.ts           # bootstrap do Fastify
  app.ts              # configuração da app (plugins, routes)
  db/
    index.ts          # conexão Drizzle
    schema.ts         # schema Drizzle (vazio nesta etapa, preparado)
    migrations/       # pasta de migrations
  plugins/
    request-id.ts     # plugin Fastify para requestId
  lib/
    errors.ts         # classes de erro padronizadas
    error-handler.ts  # handler global de erros
  routes/
    health.ts         # GET /health
```

**Rationale:** estrutura flat e simples no início. Camadas de `services/` e rotas de domínio serão adicionadas conforme as features forem implementadas. Evita abstrações prematuras.

### 2. RequestId — plugin Fastify nativo

Fastify já possui suporte nativo a `requestId` via `genReqId`. Vamos usar o mecanismo built-in do Fastify com o logger Pino integrado, que propaga automaticamente o `requestId` em todos os logs da request.

**Alternativa descartada:** middleware custom separado — desnecessário quando o Fastify já resolve isso nativamente.

### 3. Error handling — classes de erro + handler centralizado

Criar classes de erro que estendem `Error` com `statusCode` e `code` (ex: `BusinessRuleError`, `NotFoundError`). Um `setErrorHandler` global no Fastify converte essas exceções no formato padronizado da seção 10 do plano.

**Alternativa descartada:** schemas de erro por rota — excessivo para o padrão uniforme definido no plano.

### 4. Testes — Vitest + testcontainers

Usar Vitest como test runner (rápido, ESM nativo, compatível com TypeScript). Para o PostgreSQL nos testes, usar `testcontainers` para subir um container PostgreSQL por test suite, garantindo isolamento real.

Cada test suite:
1. Sobe container PostgreSQL via testcontainers
2. Roda migrations via Drizzle
3. Executa testes com rollback transacional entre cada test
4. Derruba o container ao final

**Alternativa descartada:** Docker Compose separado para testes — mais lento e menos isolado.

### 5. Configuração — variáveis de ambiente com defaults

Usar um módulo `src/config.ts` que lê variáveis de ambiente com defaults sensíveis para desenvolvimento. Sem bibliotecas extras (dotenv só para dev). Validação simples no bootstrap.

### 6. Docker — multi-stage build

Dockerfile com multi-stage: build com `npm ci` + `tsc`, runtime com apenas o `dist/` e `node_modules` de produção. Imagem base `node:22-alpine`.

## Risks / Trade-offs

- **[Testcontainers requer Docker rodando]** → Documentar no README. Docker é pré-requisito para dev de qualquer forma (Docker Compose).
- **[Sem ORM migrations nesta etapa]** → Schema Drizzle será mínimo (vazio ou só tabela de health). Migrations reais chegam com as entidades de negócio.
- **[Vitest em vez de Jest]** → Time-to-run significativamente menor. Risco baixo — API madura e amplamente adotada.

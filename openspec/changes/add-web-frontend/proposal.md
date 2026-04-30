## Why

API bfin hoje só consumida via MCP (Claude.ai) e clientes manuais. Falta interface web para usuários gerenciarem contas, transações, categorias, dívidas, metas e dashboard sem depender de assistente IA. Plano em `docs/web-frontend-plan.md` define stack Next.js 15 + Auth0 unificado.

## What Changes

- **BREAKING**: migrar `OIDC_ISSUER_URL` de Google (`https://accounts.google.com`) para tenant Auth0; definir `OIDC_AUDIENCE` como API identifier. Usuários Google precisam re-login via Auth0; `findOrCreateUser` mapeia novo `sub`.
- Adicionar `@fastify/swagger` + `@fastify/swagger-ui` + `fastify-type-provider-zod`. Expor `/openapi.json` (público) e `/docs` (protegido em prod).
- Criar repositório separado `bfin-web` (Next.js 15 App Router, TS strict, Tailwind v4, shadcn/ui, TanStack Query, Zustand, react-hook-form + zod, openapi-fetch).
- Frontend usa proxy server-side `/api/bfin/[...path]` — bearer Auth0 injetado via `getAccessToken()`, nunca exposto ao browser.
- Deploy `bfin-web` na VPS atual atrás de Caddy em `app.bfincont.com.br`.
- Adicionar `CORS_ORIGIN` para domínio web (apenas se houver chamadas diretas browser→API).

## Capabilities

### New Capabilities
- `openapi-spec`: exposição de spec OpenAPI 3.x derivada dos schemas Zod das rotas Fastify, em `/openapi.json` e UI Swagger em `/docs`.
- `web-frontend`: aplicação Next.js separada (`bfin-web`) que consome API via proxy autenticado, cobrindo CRUDs (accounts, members, categories, transactions, debts, goals), dashboard (daily limit, projections) e auth Auth0.

### Modified Capabilities
- `oidc-integration`: trocar issuer Google por Auth0 tenant, exigir `OIDC_AUDIENCE`, validar audience no JWT.
- `user-provisioning`: `findOrCreateUser` deve aceitar `sub` Auth0 (formato diferente de Google), preservando contas existentes via estratégia de migração (re-link por email ou re-onboarding).

## Impact

- **Código backend**: `src/config.ts` (novas envs), `src/plugins/auth-guard.ts` (validação audience), `src/services/user-service.ts` (`findOrCreateUser`), `src/app.ts` (registro swagger), todas rotas em `src/routes/*` (provider Zod).
- **Envs**: `OIDC_ISSUER_URL`, `OIDC_AUDIENCE` (nova), `CORS_ORIGIN`.
- **Testes**: hurl E2E e vitest precisam usar token Auth0 (não Google). Atualizar `.hurl/e2e.hurl` e fixtures.
- **MCP server**: já usa Auth0 — sem mudança.
- **Infra**: nova entrada Caddy para `app.bfincont.com.br` apontando para container Next.
- **Dependências novas (API)**: `@fastify/swagger`, `@fastify/swagger-ui`, `fastify-type-provider-zod`.
- **Repo novo**: `bfin-web` (fora deste repo na fase 1; possível promoção para monorepo pnpm depois).
- **Usuários atuais**: re-login obrigatório após cutover OIDC.

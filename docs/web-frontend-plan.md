# Plano de implementação — Interface web (Next.js)

Documento de planejamento para criação de frontend web que consome a API Fastify atual do bfin.

## Contexto da API atual

- **Backend**: Fastify + TypeScript em `src/` (mantém-se intocado).
- **Auth**: Bearer JWT validado em `src/plugins/auth-guard.ts`. Issuer atual = Google (`OIDC_ISSUER_URL=https://accounts.google.com`). Auth0 já configurado para fluxo MCP HTTP+SSE.
- **CORS**: configurável via env `CORS_ORIGIN` (`src/app.ts:65`).
- **Account scoping**: cada rota recebe `contaId` via path param ou body — não há header global. Frontend precisa carregar conta ativa e injetar em chamadas (`src/plugins/account-authorization.ts`).
- **Rotas disponíveis**: accounts, account-members, categories, transactions, debts, goals, projections, me, health, privacy.

## Decisões de stack

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | Next.js 15 App Router + TS strict | SSR opcional, RSC, file routing, deploy simples |
| Runtime | Node (não edge) | Auth0 SDK v4 + cookies |
| Auth | `@auth0/nextjs-auth0` v4 | Já usado no MCP, unifica issuer |
| Estilo | Tailwind v4 + shadcn/ui | Componentes rápidos, sem lock-in |
| State server | TanStack Query v5 | Cache, retry, mutations |
| State client | Zustand | Conta ativa + UI leve |
| Forms | react-hook-form + zod | Schemas Zod alinhados com API |
| HTTP | openapi-fetch + openapi-typescript | Tipos end-to-end via spec OpenAPI |
| Tabelas | TanStack Table v8 | Headless, tipado |
| Datas | date-fns + react-day-picker | BR locale |
| Charts | Recharts ou Tremor | Projections / dashboard |
| Testes | Vitest + Testing Library + Playwright | Mesmo runner do backend |
| Lint | ESLint + Prettier | Padrão Next |
| Pkg manager | pnpm | Workspaces, performance |

## Estrutura de repositório

Decisão: **repo separado** `bfin-web` na fase 1. Promover para monorepo pnpm se compartilhar tipos virar dor.

```
bfin-web/
├── app/
│   ├── (auth)/login/
│   ├── (app)/
│   │   ├── layout.tsx          # AccountSwitcher + Nav
│   │   ├── page.tsx            # dashboard
│   │   ├── transactions/
│   │   ├── accounts/
│   │   ├── categories/
│   │   ├── debts/
│   │   ├── goals/
│   │   ├── projections/
│   │   └── members/
│   ├── api/
│   │   ├── auth/[...auth0]/    # Auth0 handler
│   │   └── bfin/[...path]/     # proxy server-side (injeta bearer)
│   └── layout.tsx
├── lib/
│   ├── api-client.ts
│   ├── auth.ts
│   └── query-client.ts
├── components/ui/              # shadcn
├── features/
│   └── transactions/
│       ├── hooks.ts
│       ├── schema.ts
│       └── components/
└── middleware.ts               # protege (app)/*
```

Promoção para monorepo (fase futura):

```
bfin/
├── pnpm-workspace.yaml
├── apps/
│   ├── api/                    # Fastify atual
│   └── web/
└── packages/
    └── shared/                 # zod + tipos
```

## Fluxo de autenticação

1. Usuário faz login via Auth0 (`@auth0/nextjs-auth0`).
2. Sessão armazenada em cookie `appSession` HTTP-only.
3. Chamadas do client → route handler proxy `/api/bfin/[...path]`.
4. Proxy server-side recupera `accessToken` via `getAccessToken()` e encaminha à API Fastify com `Authorization: Bearer ...`.
5. Frontend nunca expõe token ao browser.

Vantagens: sem CORS público, sem token em JS, refresh transparente.

## Mudanças necessárias no backend

- **OIDC issuer unificado para Auth0**: trocar `OIDC_ISSUER_URL` para tenant Auth0 + definir `OIDC_AUDIENCE` (API identifier). Migrar usuários Google ou aceitar dois issuers (requer código novo).
- **CORS**: adicionar domínio web em `CORS_ORIGIN` apenas se houver chamadas diretas browser→API (não necessário com proxy).
- **OpenAPI**: adicionar `@fastify/swagger` + `@fastify/swagger-ui`. Expor spec em `/openapi.json`. Schemas Zod das rotas convertidos via `zod-to-json-schema` ou `fastify-type-provider-zod`.

## Fases

### Fase 0 — Setup backend (1 dia)
- API: adicionar `@fastify/swagger` + `@fastify/swagger-ui` + `fastify-type-provider-zod`.
- Expor `/openapi.json` (público) e `/docs` (protegido em prod).
- Migrar `OIDC_ISSUER_URL` para Auth0; ajustar `findOrCreateUser` para `sub` Auth0.
- Ajustar testes hurl/vitest se issuer mudar payload.

### Fase 0.1 — Setup frontend (1 dia)
- Repo `bfin-web`, pnpm init, scaffold Next 15.
- Tailwind v4, shadcn init.
- Auth0 SDK v4 + env.
- `openapi-typescript` script: `pnpm gen:api` baixa `/openapi.json` da API local e gera `lib/api-types.ts`.
- `openapi-fetch` configurado em `lib/api-client.ts`.
- ESLint, Prettier, TS strict.
- GitHub Actions: typecheck + build + `gen:api` em CI contra spec versionada.

### Fase 1 — Auth + Layout (2 dias)
- Login Auth0, middleware protege `(app)/*`, logout.
- Layout autenticado: sidebar, topbar, account switcher (`GET /accounts` + `/me`).
- Proxy `/api/bfin/[...path]` com injeção de bearer.
- Zustand store para conta ativa (persistido em cookie/localStorage).

### Fase 2 — CRUDs core (4-6 dias)
- Accounts: list, create, members add/list.
- Categories: list, create.
- Transactions: list paginado + filtros, create, edit, delete.
- Debts: list, create, pay-installment.
- Goals: list, create, update.

### Fase 3 — Dashboard + Projections (2-3 dias)
- Widget daily limit.
- Chart projections (Recharts).
- Resumo mensal por categoria.

### Fase 4 — Polish (2 dias)
- Skeletons, error boundaries, toast (sonner), empty states.
- Mobile responsive.
- Acessibilidade (radix cobre base).

### Fase 5 — Deploy (1 dia)
- Container Next na VPS atual atrás de Caddy → `app.bfincont.com.br`.
- Alternativa: Vercel.
- E2E Playwright contra staging.

**Estimativa total**: 12-17 dias dev solo.

## Decisões confirmadas

1. **Repositório**: separado, `bfin-web`.
2. **Auth0 unificado para API**: sim. Trocar `OIDC_ISSUER_URL` para tenant Auth0, definir `OIDC_AUDIENCE`, migrar `findOrCreateUser` para mapear `sub` Auth0.
3. **Deploy**: VPS atual + Caddy em `app.bfincont.com.br`.
4. **OpenAPI**: gerar desde a fase 1 via `@fastify/swagger` + `@fastify/swagger-ui`. Frontend consome com `openapi-fetch` + `openapi-typescript` para tipos automáticos.

## Riscos

- **Migração OIDC Google → Auth0**: usuários existentes precisam re-login; mapeamento `idProvedor` muda. Avaliar `findOrCreateUser` em `src/services/user-service.ts`.
- **Account scoping repetitivo**: cada chamada precisa `contaId`. Centralizar em hook `useApi(accountId)` evita duplicação.
- **Refresh token Auth0**: garantir rotação correta em proxy long-lived.
- **Rate limit API**: proxy multiplica requests; revisar `RATE_LIMIT_MAX` se necessário.

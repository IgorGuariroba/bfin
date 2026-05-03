## 1. Backend — OpenAPI

- [x] 1.1 Adicionar deps `@fastify/swagger`, `@fastify/swagger-ui`, `fastify-type-provider-zod` em `package.json`
- [x] 1.2 Registrar `serializerCompiler` + `validatorCompiler` Zod no `src/app.ts`
- [x] 1.3 Registrar `@fastify/swagger` com info, servers e componente `ApiError` reutilizável
- [x] 1.4 Registrar `@fastify/swagger-ui` em `/docs`; gate por `NODE_ENV === 'production'` exigindo bearer admin
- [x] 1.5 Migrar rotas de `src/routes/*` (accounts, account-members, categories, transactions, debts, goals, projections, me, daily-limit, privacy, health) para usar type provider Zod com schemas `body`/`querystring`/`params`/`response`
- [x] 1.6 Anotar respostas `4xx`/`5xx` com `$ref` para `ApiError` em todas as rotas
- [x] 1.7 Verificar `/openapi.json` gerado contra rotas existentes via teste (snapshot ou contagem de paths)
- [x] 1.8 Atualizar README com instruções de acesso a `/openapi.json` e `/docs`

## 2. Backend — Migração OIDC para Auth0

- [x] 2.1 Criar API identifier no tenant Auth0 (audience) e documentar valor em README/secrets
- [x] 2.2 Tornar `OIDC_AUDIENCE` obrigatória em `src/config.ts` (Zod schema falha se ausente)
- [x] 2.3 Atualizar `src/plugins/auth-guard.ts` para validar claim `aud` contém `OIDC_AUDIENCE`; retornar `TOKEN_INVALID` caso contrário
- [x] 2.4 Atualizar `src/services/user-service.ts` `findOrCreateUser` para: (a) lookup por `id_provedor`, (b) fallback lookup por `email` exigindo `email_verified === true`, (c) re-link atualizando `id_provedor`, (d) erro `EMAIL_NOT_VERIFIED` se claim ausente/false
- [x] 2.5 Atualizar `.env.example` com `OIDC_ISSUER_URL` Auth0 e `OIDC_AUDIENCE`
- [x] 2.6 Atualizar `.hurl/e2e.hurl` para usar token Auth0 (machine-to-machine ou client credentials para teste); ajustar `npm run test:hurl` se necessário
- [x] 2.7 Atualizar fixtures vitest para tokens Auth0; rodar `npm run test`
- [x] 2.8 Comunicar cutover via release notes; planejar janela de manutenção
- [x] 2.9 Rotacionar envs em staging, smoke test com `gcloud auth` substituído por Auth0 CLI/curl
- [x] 2.10 Promover para produção; monitorar logs auth por 24h

## 3. Backend — Infra & rate limit

- [ ] 3.1 Revisar `RATE_LIMIT_MAX` em `src/config.ts` considerando proxy Next multiplicar requests
- [ ] 3.2 Adicionar `app.bfincont.com.br` em `CORS_ORIGIN` apenas se necessário (proxy server-side normalmente dispensa)
- [ ] 3.3 Auditar segurança após mudanças em config/env (rodar skill de auditoria conforme CLAUDE.md)

## 4. Frontend — Setup repo bfin-web

- [ ] 4.1 Criar repositório `bfin-web` (GitHub), `pnpm init`, scaffold `create-next-app@latest` Next.js 15 App Router TS strict
- [ ] 4.2 Configurar Tailwind v4, shadcn/ui init
- [ ] 4.3 Adicionar deps: `@auth0/nextjs-auth0` v4, `@tanstack/react-query` v5, `zustand`, `react-hook-form`, `zod`, `openapi-fetch`, `openapi-typescript`, `@tanstack/react-table` v8, `recharts`, `date-fns`, `react-day-picker`
- [ ] 4.4 Configurar ESLint + Prettier + TS strict + path aliases
- [ ] 4.5 Adicionar Vitest + Testing Library + Playwright config
- [ ] 4.6 Criar script `pnpm gen:api` que baixa `/openapi.json` (env `BFIN_API_URL`) e gera `lib/api-types.ts` via `openapi-typescript`
- [ ] 4.7 GitHub Actions: typecheck, lint, build, `pnpm gen:api` em CI

## 5. Frontend — Auth + layout

- [ ] 5.1 Configurar `@auth0/nextjs-auth0` v4 (envs `AUTH0_*`), montar handler `app/api/auth/[...auth0]/route.ts`
- [ ] 5.2 `middleware.ts` protege `(app)/*` redirecionando não autenticados para login
- [ ] 5.3 Implementar route handler proxy `app/api/bfin/[...path]/route.ts` que recupera `accessToken` via `getAccessToken()` e encaminha para `BFIN_API_URL`
- [ ] 5.4 `lib/api-client.ts` configura `openapi-fetch` apontando para `/api/bfin`
- [ ] 5.5 Layout autenticado: sidebar, topbar, AccountSwitcher carrega `GET /accounts` e `GET /me`
- [ ] 5.6 Zustand store de conta ativa persistido (cookie); invalida queries ao trocar
- [ ] 5.7 Logout endpoint funcional

## 6. Frontend — CRUDs

- [ ] 6.1 Accounts: list, create, members add/list (`features/accounts/`)
- [ ] 6.2 Categories: list, create
- [ ] 6.3 Transactions: list paginado com filtros (data, categoria, tipo), create, edit, delete
- [ ] 6.4 Debts: list, create, pagar parcela
- [ ] 6.5 Goals: list, create, update
- [ ] 6.6 Forms usam react-hook-form + zod com schemas derivados de `lib/api-types.ts`

## 7. Frontend — Dashboard

- [ ] 7.1 Widget daily limit consumindo `GET /contas/<id>/limite-diario`
- [ ] 7.2 Gráfico Recharts de projeções consumindo `GET /contas/<id>/projecoes`
- [ ] 7.3 Resumo mensal por categoria (cartões/lista)

## 8. Frontend — Polish

- [ ] 8.1 Skeletons em todas listas; error boundaries por feature
- [ ] 8.2 Toaster (sonner) integrado a mutations
- [ ] 8.3 Empty states em todas listas vazias
- [ ] 8.4 Responsividade mobile validada nas rotas principais
- [ ] 8.5 Auditoria a11y básica (axe DevTools)

## 9. Frontend — Deploy

- [ ] 9.1 Dockerfile multi-stage para Next.js standalone
- [ ] 9.2 Pipeline GHCR push em master (paridade com `bfin`)
- [ ] 9.3 Caddy: adicionar `app.bfincont.com.br` apontando para container Next na VPS
- [ ] 9.4 Configurar envs de produção (Auth0, `BFIN_API_URL`)
- [ ] 9.5 Smoke test E2E Playwright contra staging
- [ ] 9.6 Promover para prod, validar TLS e fluxos críticos

## 10. Documentação

- [ ] 10.1 README de `bfin-web` com setup, envs, scripts, deploy
- [ ] 10.2 Atualizar `docs/web-frontend-plan.md` apontando para change archived após conclusão
- [ ] 10.3 Documentar em `docs/` migração OIDC (cutover, rollback)

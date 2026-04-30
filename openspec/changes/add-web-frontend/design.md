## Context

API bfin (Fastify + TS) já em produção, hoje consumida por:
- MCP server STDIO (`src/mcp/server.ts`) usado por Claude.ai via OAuth Auth0.
- Clientes manuais (hurl/posting) com token Google ID.

Auth atual da API HTTP usa OIDC Google (`OIDC_ISSUER_URL=https://accounts.google.com`) validado em `src/plugins/auth-guard.ts`. Account scoping é por `contaId` em path/body — não há header global.

Plano `docs/web-frontend-plan.md` propõe Next.js 15 separado em `bfin-web` consumindo a API via proxy server-side com Auth0. Decisão estratégica: unificar issuer da API HTTP com Auth0 (MCP já usa Auth0), eliminando dois provedores OIDC diferentes em produção.

## Goals / Non-Goals

**Goals:**
- Expor OpenAPI 3.x autogerada dos schemas Zod das rotas, consumível por `openapi-typescript`.
- Migrar issuer da API HTTP de Google para Auth0 com audience obrigatória.
- Documentar contratos para frontend Next.js separado (auth proxy, account scoping, error shape).
- Publicar `app.bfincont.com.br` na VPS atual via Caddy.
- Manter MCP server e CLI manual funcionais durante e após cutover.

**Non-Goals:**
- Implementar UI dentro deste repo (vive em `bfin-web`).
- Manter compatibilidade com tokens Google após cutover (re-login forçado é aceito).
- Promover monorepo pnpm na fase 1 (decisão posterior).
- Edge runtime no Next (precisa Node por Auth0 SDK v4).
- Refatorar account scoping para header global (`X-Conta-Id`) — fora do escopo.

## Decisions

### D1: Issuer único Auth0 (vs dual issuer Google + Auth0)
- **Escolha**: cutover hard para Auth0. Um único `OIDC_ISSUER_URL` aponta para tenant Auth0; `OIDC_AUDIENCE` torna-se obrigatório.
- **Rationale**: dual issuer requer código novo no `auth-guard` (multiplexar JWKS por `iss`), aumenta superfície de teste e não tem ganho duradouro — usuários atuais são poucos e re-login é aceitável.
- **Alternativa rejeitada**: aceitar ambos issuers durante janela de transição. Adiciona complexidade permanente sem benefício.
- **Migração de usuários**: `findOrCreateUser` ganha lookup por email se `sub` não bate — re-link da conta existente ao novo `id_provedor` Auth0. Garante zero perda de dados sem exigir intervenção manual.

### D2: OpenAPI gerada de schemas Zod (vs YAML manual)
- **Escolha**: `fastify-type-provider-zod` + `@fastify/swagger` + `@fastify/swagger-ui`. Spec serializada em `/openapi.json`, UI em `/docs`.
- **Rationale**: rotas já usam Zod via `zodToJsonSchema`. Provider oficial elimina sync drift entre runtime validation e contrato publicado.
- **Alternativa rejeitada**: manter YAML à mão — drift garantido em projeto vivo.
- **Acesso**: `/openapi.json` público (permite `openapi-typescript` em CI), `/docs` exige `NODE_ENV !== 'production'` ou bearer admin.

### D3: Frontend chama API via proxy server-side (vs SPA com bearer no browser)
- **Escolha**: route handler Next `/api/bfin/[...path]` recupera `accessToken` via `getAccessToken()` do `@auth0/nextjs-auth0` v4 e encaminha à API Fastify com `Authorization: Bearer ...`.
- **Rationale**: token nunca toca browser → sem XSS leak; sem CORS público → API só aceita origin `app.bfincont.com.br` se necessário; refresh transparente; uniformiza com padrão MCP que usa Auth0 server-side.
- **Alternativa rejeitada**: SPA com bearer em memória — exige CORS aberto, refresh complexo, exposição a XSS.
- **Trade-off**: proxy duplica hops (browser → Next → API). Latência aceitável (mesma VPS). Rate limit API multiplica — revisar `RATE_LIMIT_MAX`.

### D4: Repo separado `bfin-web` (vs monorepo pnpm imediato)
- **Escolha**: repo novo `bfin-web` na fase 1.
- **Rationale**: deploy, CI e versionamento independentes; menor risco de quebrar API ao iterar UI; promoção a monorepo é trivial depois (`pnpm-workspace.yaml`).
- **Alternativa rejeitada**: monorepo desde dia 1 — overhead de tooling sem ganho até haver código compartilhado real.
- **Compartilhamento de tipos**: via `openapi-typescript` consumindo `/openapi.json` publicado.

### D5: Tipos end-to-end via openapi-typescript (vs publicar package compartilhado)
- **Escolha**: `pnpm gen:api` no `bfin-web` baixa `/openapi.json` da API e gera `lib/api-types.ts`.
- **Rationale**: zero acoplamento de build, funciona com repos separados, types sempre derivados da spec real.
- **Trade-off**: depende de API estar acessível em CI. Mitigação: versionar última `openapi.json` no repo `bfin-web`.

### D6: Stack frontend
- Next.js 15 App Router (RSC + file routing), Node runtime.
- Tailwind v4 + shadcn/ui (Radix base — acessibilidade), TanStack Query v5 (cache server-state), Zustand (conta ativa), react-hook-form + zod, openapi-fetch, TanStack Table v8, Recharts, date-fns + react-day-picker (locale BR), Vitest + Testing Library + Playwright, ESLint + Prettier, pnpm.
- **Rationale**: alinhado com decisões já presentes no plano. Reaproveita Zod (já usado na API).

### D7: Deploy via Caddy na VPS atual
- **Escolha**: container Next.js servindo em porta interna; Caddy faz reverse proxy de `app.bfincont.com.br` → container.
- **Rationale**: infra já existente (Caddy serve `api.bfincont.com.br/mcp`); zero custo adicional; TLS automático.
- **Alternativa**: Vercel — descartado para evitar dependência externa e custos por bandwidth.

## Risks / Trade-offs

- **Migração OIDC Google → Auth0 quebra tokens existentes** → cutover comunicado; `findOrCreateUser` re-linka via email para preservar dados; janela de manutenção curta.
- **`fastify-type-provider-zod` pode divergir de schemas atuais** (rotas hoje declaram schemas via `zodToJsonSchema` manual) → migrar rota a rota com testes hurl validando contrato; aceitar tempo extra na fase 0.
- **Proxy multiplica requests à API** → revisar `RATE_LIMIT_MAX` em `src/config.ts`; considerar bypass de rate-limit por IP do proxy interno.
- **`/openapi.json` público vaza estrutura interna** → aceitável (rotas autenticadas), mas auditar antes de expor para minimizar superfície.
- **Refresh token Auth0 long-lived no proxy** → seguir best practice `@auth0/nextjs-auth0` v4 (rotation automática); monitorar erros de refresh em logs.
- **Re-link por email assume email único e verificado** → validar claim `email_verified` antes de re-link; falhar fechado se ausente.
- **CORS**: com proxy, `CORS_ORIGIN` permanece restrito; se algum dia houver chamada direta browser→API (ex: webhooks), revisitar.

## Migration Plan

1. **Fase 0a — OpenAPI**: registrar plugins swagger, migrar rotas para `fastify-type-provider-zod`, validar `/openapi.json` contra hurl atual. Sem mudança de auth ainda.
2. **Fase 0b — Auth0 cutover**: criar Auth0 API identifier (audience), configurar tenant, atualizar `OIDC_ISSUER_URL` + `OIDC_AUDIENCE` em staging. Adaptar `findOrCreateUser` (re-link por email). Atualizar hurl/vitest fixtures para token Auth0. Smoke test completo.
3. **Comunicar cutover** a usuários atuais (poucos, conhecidos): janela curta, re-login esperado.
4. **Promover prod**: rotacionar envs, redeploy. Monitorar logs auth.
5. **Fase 1+ frontend**: scaffold `bfin-web`, implementar fases conforme plano. Deploy `app.bfincont.com.br` quando MVP pronto.

**Rollback**: reverter `OIDC_ISSUER_URL` para Google; `findOrCreateUser` continua aceitando ambos formatos de `sub` durante janela. OpenAPI plugin é aditivo — remover se causar regressão.

## Open Questions

- Re-link por email cobre todos usuários atuais? Confirmar que todos têm `email_verified` no token Google.
- Manter `/docs` público ou exigir auth? (proposta: público em dev/staging, restrito em prod).
- Usar Auth0 Organizations para multi-tenant futuro ou só audience única?
- Estratégia de versionamento da spec (`/openapi.json` vs `/v1/openapi.json`) caso haja breaking changes futuros.

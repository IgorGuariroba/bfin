# OIDC Migration: Google → Auth0

## Overview

A API HTTP do bfin migrou seu issuer OIDC de Google (`https://accounts.google.com`) para Auth0, unificando com o MCP server (que já usava Auth0) e suportando o frontend web `bfin-web`. A `OIDC_AUDIENCE` agora é obrigatória e validada em cada request.

**Status**: cutover concluído em produção. Este documento serve como referência operacional para auditoria, rollback e onboarding de novos ambientes.

## What Changed

| Componente | Antes | Depois |
|---|---|---|
| `OIDC_ISSUER_URL` | `https://accounts.google.com` | `https://<tenant>.auth0.com` |
| `OIDC_AUDIENCE` | opcional (não validada) | **obrigatória** — validada contra claim `aud` |
| Validação `aud` em `auth-guard` | ausente | falha com `TOKEN_INVALID` se `aud` não bate |
| `findOrCreateUser` | match só por `sub` | (a) lookup por `id_provedor`, (b) fallback por `email` exigindo `email_verified === true`, (c) re-link atualizando `id_provedor` |
| Claim `email_verified` | ignorada | obrigatória ≥ true para re-link; falha `EMAIL_NOT_VERIFIED` caso contrário |
| Tokens existentes (Google) | aceitos | rejeitados — re-login obrigatório |
| `.hurl/e2e.hurl` | token Google (`gcloud auth`) | token Auth0 (client credentials / m2m) |
| Fixtures vitest | mock Google | mock Auth0 |

Trechos relevantes do código:

- `src/config.ts` (Zod schema obriga `OIDC_ISSUER_URL` + `OIDC_AUDIENCE`).
- `src/plugins/auth-guard.ts:75-89` (validação de `aud`).
- `src/services/user-service.ts:36-69` (lookup por `id_provedor` → fallback email com re-link).

## Auth0 Setup (one-time)

1. **Criar API identifier** no tenant Auth0:
   - Dashboard → APIs → Create API.
   - Identifier: `https://api.bfincont.com.br` (esse valor vira `OIDC_AUDIENCE`).
   - Signing algorithm: `RS256`.
2. **Configurar applications** que vão emitir tokens com essa audience:
   - Web app (`bfin-web`): Regular Web Application → Authorized Audience inclui o identifier acima.
   - MCP server: já configurado em produção, usa o mesmo tenant.
   - Client de teste (CI/hurl): Machine-to-Machine application autorizada na API criada acima.
3. **Permitir conexões de identidade** (Google social, email/senha) e exigir `email verification` para re-link automático funcionar.

## Environment Variables

| Variável | Obrigatória | Valor produção |
|---|---|---|
| `OIDC_ISSUER_URL` | sim | `https://<tenant>.auth0.com` (com `/` opcional, sem `/.well-known`) |
| `OIDC_AUDIENCE` | sim | `https://api.bfincont.com.br` |
| `OIDC_ALLOW_INSECURE` | não | sempre `false` em prod (config rejeita `true` se `NODE_ENV=production`) |

Atualizar `.env.example`, `.env` em todos ambientes, secrets em GitHub Actions e variáveis SSH na VPS.

## Cutover Procedure

Janela: ~5 minutos (rotação de envs + redeploy + healthcheck). Re-login forçado para usuários atuais.

### Pré-cutover (T-1 dia)

1. Anunciar janela aos usuários ativos (Telegram/email): horário, expectativa de re-login.
2. Confirmar que todos usuários atuais têm `email_verified=true` no Google (re-link automático depende disso).
3. Aplicar mudanças de código em master (já feito):
   - `src/config.ts` — `OIDC_AUDIENCE` obrigatória.
   - `src/plugins/auth-guard.ts` — validação `aud`.
   - `src/services/user-service.ts` — lookup duplo + `email_verified`.
4. Rodar `npm run test` e `npm run test:hurl` em staging com envs Auth0 já configurados.
5. Smoke test em staging: login real via tenant Auth0, criar conta, listar transações — confirmar `200 OK`.

### Cutover em produção (T-0)

1. **Rotacionar envs** em `/opt/bfin/.env`:
   ```
   OIDC_ISSUER_URL=https://<tenant>.auth0.com
   OIDC_AUDIENCE=https://api.bfincont.com.br
   ```
2. **Redeploy** API (CI/CD em master ou `docker compose pull api && docker compose up -d api`).
3. **Verificação imediata**:
   ```bash
   # Token Google deve falhar agora
   curl -i -H "Authorization: Bearer <google-id-token>" https://api.bfincont.com.br/me
   # → 401 TOKEN_INVALID

   # Token Auth0 com aud correto deve passar
   curl -i -H "Authorization: Bearer <auth0-access-token>" https://api.bfincont.com.br/me
   # → 200 OK
   ```
4. **Re-login do primeiro usuário existente**: confirmar nos logs que `findOrCreateUser` fez re-link (`UPDATE usuarios SET id_provedor = '<auth0-sub>' WHERE email = '<email>'`).
5. **Anunciar conclusão** aos usuários.

### Pós-cutover (T+24h)

1. Monitorar logs auth: filtrar por `code="TOKEN_INVALID"`, `code="EMAIL_NOT_VERIFIED"`, `code="EMAIL_CONFLICT"`.
2. Se houver `EMAIL_NOT_VERIFIED`: usuário precisa verificar email no Auth0 antes do re-link.
3. Se houver `EMAIL_CONFLICT`: investigar manualmente — implica DB com email duplicado em provedor diferente (raro).
4. Após 24h sem regressões: arquivar este cutover.

## Rollback

Cenário: regressão crítica detectada (ex.: massa de `TOKEN_INVALID` com tokens válidos, JWKS Auth0 indisponível, claim mismatch sistemático).

### Opção A — Rollback rápido (envs)

Reverte API ao estado pré-cutover sem redeploy de código. Aceita tokens Google novamente.

1. Rotacionar `/opt/bfin/.env`:
   ```
   OIDC_ISSUER_URL=https://accounts.google.com
   OIDC_AUDIENCE=<audience-google-anterior-ou-remover>
   ```
   > **Nota**: a Zod schema atual obriga `OIDC_AUDIENCE`. Para rollback puro de envs sem alterar código, configure `OIDC_AUDIENCE` para o `aud` que o Google ID Token traz (geralmente o `client_id` da OAuth 2.0 application do Google). Caso contrário, vá para a Opção B.
2. `docker compose -f docker-compose.vps.yml --env-file /opt/bfin/.env up -d api`.
3. **Estado dos usuários**:
   - Usuários **não** re-linkados ainda: continuam funcionando com Google (registro intacto).
   - Usuários **já re-linkados** durante a janela Auth0: `id_provedor` foi atualizado para sub Auth0 — Google ID Token agora **não** bate por `id_provedor`. Fallback por email continua funcionando se `email_verified=true` no Google → re-link reverso atualiza `id_provedor` de volta para o sub Google. Sem perda de dados.

### Opção B — Rollback completo (código + envs)

Necessário se a validação obrigatória de audience for o problema raiz, ou se quiser remover o requisito Zod.

1. `git revert` dos commits da change `add-web-frontend` que introduziram:
   - Obrigatoriedade de `OIDC_AUDIENCE` em `src/config.ts`.
   - Validação `aud` em `src/plugins/auth-guard.ts`.
   - Restrição `email_verified` em `src/services/user-service.ts` (opcional manter, é melhoria de segurança).
2. Reaplicar envs Google (Opção A passo 1, sem precisar de `OIDC_AUDIENCE`).
3. Deploy via CI/CD ou manual.
4. Verificar usuários re-linkados (mesma lógica da Opção A).

### Critérios de rollback

Acionar rollback se em **15 minutos pós-cutover**:
- Mais de 5% das requests autenticadas retornam `TOKEN_INVALID`/`AUTH_REQUIRED` para tokens válidos no JWKS Auth0.
- JWKS Auth0 indisponível (5xx persistente em `https://<tenant>.auth0.com/.well-known/jwks.json`).
- Erro estrutural em `findOrCreateUser` (ex.: `EMAIL_CONFLICT` para todos usuários).

Caso contrário, prefira corrigir adiante (forward-fix) — rollback re-introduz a inconsistência API↔MCP.

## Validação

### Hurl (E2E)

`.hurl/e2e.hurl` usa token Auth0 obtido via client credentials (machine-to-machine application). Atualizar `BFIN_TEST_TOKEN` env antes de rodar:

```bash
export BFIN_TEST_TOKEN=$(curl -s --request POST \
  --url https://<tenant>.auth0.com/oauth/token \
  --header 'content-type: application/json' \
  --data '{"client_id":"...","client_secret":"...","audience":"https://api.bfincont.com.br","grant_type":"client_credentials"}' \
  | jq -r .access_token)

npm run test:hurl
```

### Vitest

Fixtures em `tests/fixtures/` usam tokens Auth0 mockados (claims `iss`/`aud`/`sub` simulados). `npm run test` cobre o caminho da auth-guard sem chamar Auth0 real.

### Smoke manual

```bash
# 1. Token Auth0 válido com aud correto
curl -i -H "Authorization: Bearer $TOKEN" https://api.bfincont.com.br/me     # 200

# 2. Token sem aud
curl -i -H "Authorization: Bearer $TOKEN_NO_AUD" https://api.bfincont.com.br/me   # 401 TOKEN_INVALID

# 3. Token com email não verificado (cenário re-link)
curl -i -H "Authorization: Bearer $TOKEN_UNVERIFIED" https://api.bfincont.com.br/me   # 401 EMAIL_NOT_VERIFIED
```

## Códigos de erro novos/alterados em `auth-guard`

| HTTP | `code` | Quando |
|---|---|---|
| 401 | `TOKEN_INVALID` | claim `aud` ausente ou não bate `OIDC_AUDIENCE`; assinatura inválida; JWKS sem chave matching |
| 401 | `TOKEN_EXPIRED` | `exp` no passado |
| 401 | `EMAIL_NOT_VERIFIED` | re-link tentou via fallback email mas `email_verified !== true` |
| 401 | `EMAIL_CONFLICT` | INSERT com email já registrado por outro provedor (race condition rara após fallback) |
| 401 | `CLAIMS_INSUFFICIENT` | claim `email` ausente |
| 401 | `AUTH_REQUIRED` | header `Authorization` ausente/malformado |

## Riscos residuais

- **`email_verified=false` em conta legada**: usuário não consegue re-link automático. Mitigação: usuário verifica email no Auth0 e tenta novamente. Operador pode forçar re-link manual via UPDATE direto na DB caso necessário.
- **Refresh token Auth0 long-lived no proxy `bfin-web`**: rotação automática via SDK v4. Monitorar `bfin-web` logs para erros de refresh.
- **JWKS cache stale após rotação Auth0**: `auth-guard` usa cache de JWKS via `jose`; em caso de rotação manual de chaves no Auth0, restart do API resolve.
- **Auditoria**: skill de auditoria de segurança rodada após mudanças em `src/config.ts` e `auth-guard.ts` conforme `CLAUDE.md`.

## Referências

- Change OpenSpec: `openspec/changes/add-web-frontend/` (proposal, design, tasks 2.x).
- Plano original: [`docs/web-frontend-plan.md`](./web-frontend-plan.md).
- Frontend que consome a API: [`bfin-web/README.md`](https://github.com/<owner>/bfin-web/blob/master/README.md).
- MCP server (Auth0 paralelo): [`docs/mcp.md`](./mcp.md).

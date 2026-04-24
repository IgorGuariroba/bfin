# MCP server (Model Context Protocol)

BFin expõe um servidor MCP remoto sobre **HTTP+SSE** com autenticação **OAuth 2.1**, permitindo que usuários o utilizem como um **Connector** diretamente no `claude.ai`, ChatGPT Apps, Cursor web, e qualquer cliente MCP compatível com o spec MCP Auth (`2025-06-18`).

O servidor MCP reutiliza a mesma camada de services da API HTTP, mas com um modelo de identidade e autorização próprio: cada request carrega um Bearer token OAuth emitido pelo Auth0, com escopos finos que determinam quais tools o usuário pode invocar.

## Arquitetura em uma frase

> O BFin MCP atua como **OAuth 2.1 Resource Server**; o Auth0 é o **Authorization Server** (DCR, login Google, consent, refresh, revogação); o cliente descobre o AS via metadata RFC 9728 em `/.well-known/oauth-protected-resource` e então troca JSON-RPC 2.0 sobre HTTP+SSE.

## URL pública do Connector

```
https://api.bfincont.com.br/mcp
```

Essa é a URL que o usuário cola no cliente LLM (ex.: `claude.ai → Settings → Connectors → Add custom connector`).

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `MCP_HTTP_ENABLED` | opcional | `true` para registrar o plugin MCP HTTP (default `false`; use `true` em produção). |
| `MCP_HTTP_BASE_URL` | ✓ | URL pública onde o MCP está acessível (ex.: `https://api.bfincont.com.br/mcp`). |
| `MCP_AUDIENCE_HTTP` | ✓ | Audience esperada nos tokens OAuth (ex.: `https://mcp.bfincont.com.br`). |
| `MCP_AUTH_SERVER_URL` | ✓ | URL do Authorization Server (Auth0), ex.: `https://bfin.us.auth0.com`. |
| `MCP_PROVISIONING_ALLOWED_EMAILS` | opcional | Lista CSV ou regex de emails autorizados a serem provisionados automaticamente. Se vazio, o `sub` precisa já existir em `usuarios`. |
| `MCP_SESSION_STORE` | opcional | `memory` (default em dev) ou `redis` (recomendado em prod). |
| `REDIS_URL` | ✓ se `redis` | URL do Redis (ex.: `redis://redis:6379`). |
| `DATABASE_URL` | ✓ | Mesma string de conexão Postgres da API. |
| `LOG_LEVEL` | opcional | `info` por default. |
| `METRICS_TOKEN` | opcional | Token para autenticar o endpoint `/metrics` (Prometheus). |

### Variáveis removidas (modo STDIO antigo)

As variáveis abaixo não são mais lidas. Remova-as do `.env`:

- `MCP_OIDC_AUDIENCE`
- `MCP_SERVICE_ACCOUNT_TOKEN`
- `MCP_SUBJECT_USER_ID`

## Escopos suportados

O token OAuth carrega escopos no formato `resource:action` (padrão OAuth 2.0, separados por espaço):

| Escopo | Tools habilitadas |
|---|---|
| `accounts:read` | `accounts.list`, `accounts.get` |
| `accounts:write` | `accounts.create` |
| `account-members:read` | `account-members.list` |
| `categories:read` | `categories.list` |
| `categories:write` | `categories.create` |
| `transactions:read` | `transactions.list` |
| `transactions:write` | `transactions.create/update/delete` |
| `debts:read` | `debts.list` |
| `debts:write` | `debts.create`, `debts.pay-installment` |
| `goals:read` | `goals.list` |
| `goals:write` | `goals.create`, `goals.update` |
| `daily-limit:read` | `daily-limit_get`, `daily-limit_v2_get` |
| `daily-limit:write` | `daily-limit_set` |
| `projections:read` | `projections.get` |

A tool `mcp.whoami` é sempre exposta (sem `requiredScope`) e retorna o subject, escopos, `actingUserId` e `tokenExp` da sessão.

### `daily-limit_get` vs `daily-limit_v2_get`

Ambas requerem escopo `daily-limit:read` e `minRole: viewer`.

**`daily-limit_get`** (v1): divide `saldo_disponível` por `dias_restantes_no_mês`, subtraindo recorrentes futuras e parcelas de dívida do mês. Degenera no fim do mês.

**`daily-limit_v2_get`** (v2): `max(0, saldo_atual) / 30` com janela móvel de 30 dias. Não consulta `porcentagem_reserva`, `projecao`, recorrentes futuras nem parcelas de dívida.

Parâmetros v2: `contaId` (UUID, obrigatório), `hoje` (ISO 8601 datetime, opcional — usado em testes).

Payload de resposta v2:
```json
{
  "contaId": "uuid",
  "janela_inicio": "2026-04-24T10:00:00.000Z",
  "janela_fim": "2026-05-24T10:00:00.000Z",
  "horizonte_dias": 30,
  "saldo_atual": "2500.00",
  "limite_diario": "83.33",
  "calculado_em": "2026-04-24T10:00:00.000Z"
}
```

## Como conectar no Claude.ai

1. Acesse [claude.ai](https://claude.ai) e faça login.
2. Vá em **Settings → Connectors → Add custom connector**.
3. Cole a URL: `https://api.bfincont.com.br/mcp`.
4. O Claude detectará o metadata RFC 9728 e iniciará o fluxo OAuth (Authorization Code + PKCE).
5. Você será redirecionado para o Auth0, onde deverá clicar em **"Continuar com Google"**.
6. No consent screen, revise os escopos solicitados e clique em **Authorize**.
7. O connector aparecerá como **Connected**.
8. Em uma conversa, ative o connector e teste: *"list my transactions from last month"*.

## Provisionamento de usuários

### Automático (recomendado para onboarding)

Defina `MCP_PROVISIONING_ALLOWED_EMAILS` com uma lista de emails permitidos:

```bash
MCP_PROVISIONING_ALLOWED_EMAILS=alice@example.com,bob@example.com
```

Também é possível usar regex:

```bash
MCP_PROVISIONING_ALLOWED_EMAILS=/.*@bfincont\.com.br/i
```

O primeiro login de um usuário autorizado cria automaticamente o registro em `usuarios` usando as claims `name` e `email` do token.

### Manual (administração)

Se o provisionamento automático estiver desabilitado, insira o usuário manualmente antes do primeiro login:

```sql
INSERT INTO usuarios (id_provedor, nome, email)
VALUES ('auth0|123456789', 'Alice', 'alice@example.com')
RETURNING id;
```

O valor de `id_provedor` deve ser o `sub` do token JWT emitido pelo Auth0.

## Auditoria

Cada invocação de tool registra um evento estruturado em `pino` (nível `info`) com:

- `sub`: identificador do usuário no IdP
- `user_id`: UUID interno (`actingUserId`)
- `tool`: nome da tool
- `scope`: escopo exigido
- `session_id`: ID da sessão SSE
- `duration_ms`: tempo de execução
- `outcome`: `ok` ou `error`
- `error_code`: código do erro, se houver
- `input_hash`: hash SHA256 do payload (nunca o payload cru)

Para consultar logs em produção (Docker Compose):

```bash
docker compose -f docker-compose.prod.yml logs api --tail 200 | grep '"source":"mcp"'
```

## Revogação

### Usuário desconecta no cliente

No `claude.ai`, vá em **Settings → Connectors**, encontre o BFin e clique em **Remove**. O cliente para de enviar requests; as sessões expiram naturalmente (TTL 1h no Redis, 10min em memória).

### Admin revoga acesso

No **Auth0 Dashboard**:

- **Revogar um usuário específico:** Applications → (app criada via DCR) → Delete. Ou Users → selecione o usuário → Revoke Grants.
- **Revogar todos:** API → Bfin MCP → Machine to Machine → revoke.

Após revogação, a próxima request retorna `401` com `WWW-Authenticate`, e o cliente força um novo fluxo OAuth.

## LGPD / GDPR — direito ao esquecimento

Para remover completamente um usuário do sistema (banco local + Auth0):

```bash
npm run mcp:delete-user -- --email=alice@example.com
```

Requisitos:
- Variáveis `AUTH0_MGMT_CLIENT_ID` e `AUTH0_MGMT_CLIENT_SECRET` configuradas (opcional; se omitidas, apenas o banco local é afetado).
- O comando encontra o usuário por email, deleta do Auth0 via Management API, remove do banco local (`usuarios`) e registra a ação no audit log.

## Troubleshooting

| Problema | Causa provável | Solução |
|---|---|---|
| `401 invalid_token` | Token ausente, expirado ou audience incorreta | Verifique `MCP_AUDIENCE_HTTP` e `MCP_AUTH_SERVER_URL`; renove o token no cliente |
| `403 forbidden` | Usuário não provisionado | Adicione o email em `MCP_PROVISIONING_ALLOWED_EMAILS` ou insira manualmente no banco |
| `429 rate_limit_exceeded` | Muitas requests | Aguarde a janela de 1 minuto; o rate limit é por `sub` (não por IP) |
| `404 Session not found` | Sessão SSE expirou ou servidor reiniciou (com store em memória) | Use `MCP_SESSION_STORE=redis` em produção |
| CORS preflight falha | Origin não está na allowlist | Verifique se o cliente é `https://claude.ai` ou `http://localhost:*` |
| Certificado TLS inválido | DNS não aponta para a VPS | Confira `dig +short api.bfincont.com.br` e aguarde propagação |

## Limites conhecidos

- **Sem suporte a prompts/resources do MCP** nesta versão — apenas tools.
- **Auth0 é o único AS suportado** — não implementamos endpoints de AS próprios.
- **Não há migração automática** do modo STDIO antigo — usuários devem reconectar via OAuth.

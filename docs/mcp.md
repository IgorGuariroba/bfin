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
| `MCP_ALLOWED_ORIGINS` | opcional | CSV de Origins permitidas no transport HTTP (ex.: `https://claude.ai,https://chat.openai.com`). Em produção, requisições sem header `Origin` são rejeitadas; em dev, aceitas. |

### Variáveis removidas (modo STDIO antigo)

As variáveis abaixo não são mais lidas. Remova-as do `.env`:

- `MCP_OIDC_AUDIENCE`
- `MCP_SERVICE_ACCOUNT_TOKEN`
- `MCP_SUBJECT_USER_ID`

## Tools

| Name | Title | Description | Required Scope |
|---|---|---|---|
| `accounts_list` | List Accounts | List accounts accessible by the service account's acting user. | `accounts:read` |
| `accounts_get` | Get Accounts | Get details of a specific account by id. | `accounts:read` |
| `accounts_create` | Create Accounts | Create a new account; the service account becomes the owner. | `accounts:write` |
| `account-members_list` | List Account Members | List members (users) associated with an account and their roles. | `account-members:read` |
| `account-members_add` | Add Account Members | Add a user to an account by email. Only owners can add members. | `account-members:write` |
| `categories_list` | List Categories | List categories, optionally filtered by tipo or busca. | `categories:read` |
| `categories_create` | Create Categories | Create a new category. contaId is required to enforce role check. | `categories:write` |
| `transactions_list` | List Transactions | List transactions for an account. | `transactions:read` |
| `transactions_create` | Create Transactions | Create a new transaction in an account. | `transactions:write` |
| `transactions_update` | Update Transactions | Update an existing transaction. | `transactions:write` |
| `transactions_delete` | Delete Transactions | Delete an existing transaction. | `transactions:delete` |
| `debts_list` | List Debts | List debts for an account. | `debts:read` |
| `debts_create` | Create Debts | Create a new installment debt with generated parcelas. | `debts:write` |
| `debts_pay-installment` | Pay Installment Debts | Confirm payment of a specific installment; emits a transaction. | `debts:write` |
| `goals_list` | List Goals | Get the current reserve goal (meta) for an account, or null if unset. | `goals:read` |
| `goals_create` | Create Goals | Create the reserve goal for an account. | `goals:write` |
| `goals_update` | Update Goals | Update the reserve goal for an account (upsert semantics). | `goals:write` |
| `daily-limit_get` | Get Daily Limit | Compute the daily spending limit for an account for the current month. **DEPRECATED** (sunset 2026-07-23). | `daily-limit:read` |
| `daily-limit_v2_get` | Get Daily Limit_v2 | Compute the daily spending limit v2 for an account: max(0, balance) / 30 over a rolling 30-day window. | `daily-limit:read` |
| `daily-limit_set` | Set Daily Limit | Configure the reserve percentage that affects daily-limit calculation. **DEPRECATED** (sunset 2026-07-23). | `daily-limit:write` |
| `projections_get` | Get Projections | Resolve the persisted/recomputed monthly projection for an account. | `projections:read` |
| `mcp_whoami` | Introspect Identity | Introspect the current MCP service account identity: subject, scopes, actingUserId, tokenExp. | — |

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
| `transactions:write` | `transactions.create`, `transactions.update` |
| `transactions:delete` | `transactions.delete` |
| `debts:read` | `debts.list` |
| `debts:write` | `debts.create`, `debts.pay-installment` |
| `goals:read` | `goals.list` |
| `goals:write` | `goals.create`, `goals.update` |
| `daily-limit:read` | `daily-limit_get`, `daily-limit_v2_get` |
| `daily-limit:write` | ~~`daily-limit_set`~~ **DEPRECATED** (sunset 2026-07-23) |
| `projections:read` | `projections.get` |

A tool `mcp.whoami` é sempre exposta (sem `requiredScope`) e retorna o subject, escopos, `actingUserId` e `tokenExp` da sessão.

### `daily-limit_get` vs `daily-limit_v2_get`

> **Caminho recomendado:** use `daily-limit_v2_get` para novos integradores. As tools v1 estão **deprecated** (sunset 2026-07-23).

Ambas requerem escopo `daily-limit:read` e `minRole: viewer`.

**`daily-limit_get`** ~~(v1)~~ **DEPRECATED** (sunset 2026-07-23): divide `saldo_disponível` por `dias_restantes_no_mês`, subtraindo recorrentes futuras e parcelas de dívida do mês. Degenera no fim do mês. Migre para `daily-limit_v2_get`.

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

> **Nota sobre `daily-limit_set`:** essa tool grava `porcentagem_reserva` em `metas` via `upsertMeta`, mas esse campo **nunca afetou** o cálculo de limite diário (nem v1 nem v2). Os substitutos reais são `goals_create` e `goals_update`.

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

### Problemas comuns

| Problema | Causa provável | Solução |
|---|---|---|
| `401 invalid_token` | Token ausente, expirado ou audience incorreta | Verifique `MCP_AUDIENCE_HTTP` e `MCP_AUTH_SERVER_URL`; renove o token no cliente |
| `403 forbidden` | Usuário não provisionado | Adicione o email em `MCP_PROVISIONING_ALLOWED_EMAILS` ou insira manualmente no banco |
| `429 rate_limit_exceeded` | Muitas requests | Aguarde a janela de 1 minuto; o rate limit é por `sub` (não por IP) |
| `404 Session not found` | Sessão SSE expirou ou servidor reiniciou (com store em memória) | Use `MCP_SESSION_STORE=redis` em produção |
| CORS preflight falha | Origin não está na allowlist | Verifique se o cliente é `https://claude.ai` ou `http://localhost:*` |
| Certificado TLS inválido | DNS não aponta para a VPS | Confira `dig +short api.bfincont.com.br` e aguarde propagação |

### Códigos de erro estruturados

Quando uma tool falha, o campo `content[0].text` contém um JSON com o seguinte código:

| Código | Quando ocorre | Solução |
|---|---|---|
| `INVALID_INPUT` | Parâmetro com tipo ou formato inválido (falha Zod). | Corrija o campo indicado em `field` (ex.: UUID malformado, número no lugar de string). |
| `NOT_FOUND` | Recurso solicitado não existe (conta, transação, dívida, etc.). | Verifique o `id` informado; use a tool de `list` para confirmar os IDs válidos. |
| `FORBIDDEN` | Usuário não tem permissão (role insuficiente ou não é membro da conta). | Verifique se o usuário é `owner` ou `viewer` da conta; `owner` é necessário para writes. |
| `BUSINESS_RULE` | Regra de domínio violada (duplicata, parcela já paga, meta inexistente, etc.). | Leia a dica em `hint` (ex.: "installment already paid"); ajuste a operação conforme o estado atual. |
| `INTERNAL` | Erro inesperado no servidor. | Tente novamente em alguns segundos. Se persistir, contate o suporte. |

## Tool annotations

Toda tool registrada possui `title` e exatamente um dos hints: `readOnlyHint` ou `destructiveHint`. O helper `withAnnotations()` em `src/mcp/tools/__shared__/annotations.ts` aplica convenção por nome de tool:

- Actions `list`, `get`, `whoami` → `readOnlyHint: true`
- Actions `create`, `update`, `delete`, `set`, `pay-installment`, `add` → `destructiveHint: true`
- `title` é derivado automaticamente: `"accounts_list"` → `"List Accounts"`

O registry falha o boot se alguma tool não tiver `title` ou tiver 0/2 hints.

Validação automática: `npm run mcp:audit-names` (nomes ≤ 64 chars).

## Origin allowlist

O transport HTTP+SSE valida o header `Origin` contra `MCP_ALLOWED_ORIGINS` (CSV). Implementação em `src/mcp/transport/origin-guard.ts`.

- **Produção** (`NODE_ENV=production`): ausência de Origin é rejeitada com `403`.
- **Desenvolvimento**: ausência de Origin é aceita.
- Origem não listada → `403` + log WARN estruturado com `{ origin, path, ip }`.

Exemplo de configuração:

```bash
MCP_ALLOWED_ORIGINS=https://claude.ai,https://chat.openai.com,http://localhost:6274
```

> O MCP Inspector usa `http://localhost:6274` como Origin.

## Contrato de erro estruturado

Erros de `tools/call` retornam `isError: true` com `content[0].text` contendo JSON estável:

```json
{
  "code": "INVALID_INPUT",
  "message": "Expected string, received number",
  "field": "valor",
  "hint": null
}
```

### Códigos

| Código | Quando | Campos extras |
|---|---|---|
| `INVALID_INPUT` | Falha de validação Zod ou `ValidationError` | `field` (path do campo) |
| `NOT_FOUND` | Recurso não encontrado | — |
| `FORBIDDEN` | Sem permissão (role ou ownership) | — |
| `BUSINESS_RULE` | Violação de regra de domínio (duplicata, already paid, etc.) | `hint` (dica acionável) |
| `INTERNAL` | Erro inesperado | — |

O mapper `toMCPError()` em `src/mcp/errors.ts` cobre `ZodError`, `NotFoundError`, `BusinessRuleError`, `ForbiddenError`, `ValidationError`, subclasses de `AppError` e fallback `INTERNAL`.

## Validação via MCP Inspector

Para validar annotations e contrato de erro:

1. Instale o MCP Inspector: `npx @modelcontextprotocol/inspector`
2. Inicie o servidor: `npm run mcp:dev`
3. No Inspector, conecte via STDIO apontando para o processo
4. Execute `tools/list` e verifique que toda tool tem `title` + hint correto
5. Execute `tools/call` com input inválido e verifique JSON estruturado no erro

```bash
# Comando completo
npx @modelcontextprotocol/inspector npm run mcp:dev
```

## Conta demo

O BFin oferece uma conta demo para revisores e testes de integração.

- **Email:** `mcp-review@bfincont.com.br`
- **Dataset:** 2 contas, ~30 transações distribuídas em 90 dias, 1 dívida com 12 parcelas, 1 meta de reserva, 1 projeção cacheada.
- **Janela de reset:** 03:00 BRT diariamente. O script `scripts/reset-demo-account.ts` restaura o dataset baseline automaticamente.
- **Provisionamento:** o usuário demo é pré-cadastrado no Auth0 (sem MFA). As credenciais são entregues via formulário de submissão da Anthropic e armazenadas em secret manager (1Password).

## Política de privacidade

A política de privacidade do BFin está publicada em:

**[https://api.bfincont.com.br/privacy](https://api.bfincont.com.br/privacy)**

Ela descreve dados coletados, não coletados, finalidades, retenção, subprocessadores, direitos LGPD e contato.

## Checklist: atualizar escopos no Auth0

Ao adicionar ou alterar escopos em `src/mcp/scopes.ts`:

1. No Auth0 Dashboard → APIs → BFin MCP → Permissions
2. Adicione cada novo scope `<resource>:<action>`
3. Atualize o consent screen se necessário
4. Verifique que clientes existentes ainda funcionam (scopes são aditivos)
5. Atualize a tabela de escopos nesta documentação

## Changelog

### 2026-04-25 — Contrato de erro estruturado

- `tools/call` agora retorna erros como JSON estruturado (`{ code, message, field?, hint? }`) em vez de texto livre com códigos numéricos.
- Códigos antigos (`-32001`, `-32003`, etc.) removidos; usar códigos string (`NOT_FOUND`, `FORBIDDEN`, etc.).
- Clients que parseavam texto livre devem migrar para parsing JSON do `content[0].text`.
- O campo `message` permanece legível; clientes que não parseiam JSON continuam funcionando com perda de granularidade.

## Limites conhecidos

- **Sem suporte a prompts/resources do MCP** nesta versão — apenas tools.
- **Auth0 é o único AS suportado** — não implementamos endpoints de AS próprios.
- **Não há migração automática** do modo STDIO antigo — usuários devem reconectar via OAuth.

# MCP server (Model Context Protocol)

BFin expõe um segundo entrypoint — um servidor MCP sobre **STDIO + JSON-RPC 2.0** —
que permite a clientes MCP (Claude Desktop, Claude Code, etc.) usar as
capacidades financeiras do domínio como ferramentas.

O servidor MCP **não** passa pela API HTTP: ele reutiliza os mesmos services
in-process, mas com uma identidade separada de *service account* autenticada por
token OIDC e restringida por escopos finos.

## Arquitetura em uma frase

> O cliente MCP spawna `node dist/mcp/server.js`; o servidor valida o token OIDC
> da service account contra o mesmo provedor da API HTTP (porém com audiência
> distinta), descobre seus escopos, resolve o `userId` alvo das writes e então
> começa a atender `initialize`/`tools/list`/`tools/call` via stdin/stdout
> (logs sempre em stderr).

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `OIDC_ISSUER_URL` | ✓ (já usada pela API HTTP) | Issuer do provedor OIDC — usado para descoberta JWKS. |
| `MCP_OIDC_AUDIENCE` | ✓ | Audiência esperada do token da SA. **Deve ser distinta** de `OIDC_AUDIENCE` (API HTTP). |
| `MCP_SERVICE_ACCOUNT_TOKEN` | ✓ | JWT emitido pelo provedor OIDC para a service account, com claims `sub`, `scope`, `aud`, `exp`. |
| `MCP_SUBJECT_USER_ID` | ✓ | UUID do usuário em `usuarios` ao qual todas as writes serão atribuídas. O registro precisa existir antes do bootstrap. |
| `DATABASE_URL` | ✓ | Mesma string de conexão Postgres da API. |
| `LOG_LEVEL` | opcional | `info` por default. Todos os logs vão para **stderr**. |

## Escopos suportados

O token da SA carrega escopos no formato `resource:action` (claim `scope` do JWT,
padrão OAuth 2.0, separados por espaço):

| Escopo | Tools habilitadas |
|---|---|
| `accounts:read` | `accounts.list`, `accounts.get` |
| `accounts:write` | `accounts.create` |
| `account-members:read` | `account-members.list` |
| `categories:read` | `categories.list` |
| `categories:write` | `categories.create` (exige `owner` da conta) |
| `transactions:read` | `transactions.list` (viewer) |
| `transactions:write` | `transactions.create/update/delete` (owner) |
| `debts:read` | `debts.list` (viewer) |
| `debts:write` | `debts.create`, `debts.pay-installment` (owner) |
| `goals:read` | `goals.list` (viewer) |
| `goals:write` | `goals.create`, `goals.update` (owner) |
| `daily-limit:read` | `daily-limit.get` (viewer) |
| `daily-limit:write` | `daily-limit.set` (owner) |
| `projections:read` | `projections.get` (viewer) |

A tool `mcp.whoami` é sempre exposta (sem `requiredScope`) e é útil para
debugging — retorna o subject, escopos, actingUserId e `tokenExp` da SA.

### Recomendação: conceda o mínimo

- Se o assistente só precisa ler, conceda apenas `*:read`.
- Para escrita, comece com escopos de um único domínio (`transactions:write`).
- **Nunca** ao conceder todos os `*:*` sem necessidade clara.

## Provisionamento passo a passo

1. **Criar o usuário SA** na base (`usuarios`) — `MCP_SUBJECT_USER_ID` precisa ser
   um UUID existente. Exemplo:
   ```sql
   INSERT INTO usuarios (id_provedor, nome, email)
   VALUES ('sa-mcp', 'BFin MCP SA', 'mcp-sa@internal.example')
   RETURNING id;
   ```
2. **Associar às contas** que a SA pode operar (`conta_usuarios`) com papel
   adequado (`owner` para writes, `viewer` para somente leitura):
   ```sql
   INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
   VALUES ('<conta-uuid>', '<sa-user-uuid>', 'owner');
   ```
3. **Emitir o token da SA no provedor OIDC** com:
   - `aud = <valor de MCP_OIDC_AUDIENCE>` (distinta da API HTTP).
   - `scope = "transactions:read transactions:write ..."` (lista de escopos concedidos).
   - Expiração razoável (ex.: 7 dias) — veja "Rotação" abaixo.
4. **Build**: `npm run build` (produz `dist/mcp/server.js`).
5. **Registrar no cliente MCP** (exemplo Claude Desktop):
   ```json
   {
     "mcpServers": {
       "bfin": {
         "command": "node",
         "args": ["/caminho/absoluto/para/bfin/dist/mcp/server.js"],
         "env": {
           "DATABASE_URL": "postgres://...",
           "OIDC_ISSUER_URL": "https://login.example.com",
           "MCP_OIDC_AUDIENCE": "bfin-mcp",
           "MCP_SERVICE_ACCOUNT_TOKEN": "eyJhbGciOi...",
           "MCP_SUBJECT_USER_ID": "<sa-user-uuid>"
         }
       }
     }
   }
   ```

Durante desenvolvimento, o operador pode usar `npm run mcp:dev` que roda
`tsx src/mcp/server.ts` — lembrando que o servidor MCP é invocado diretamente
pelo cliente MCP, não roda como serviço em Docker Compose.

## `meta.requestedBy` — rastreabilidade, não autorização

O servidor MCP aceita em qualquer `tools/call` um campo opcional
`_meta.requestedBy: string`. Esse valor é:

- **Anexado ao logger** como `requested_by` na invocação (facilita responder
  "isso veio de qual usuário final na UX do cliente?").
- **Jamais usado para autorização.** A decisão de autorização deriva
  exclusivamente dos escopos do token da SA + do papel do `actingUserId` em
  `conta_usuarios`.
- Validado em tamanho (≤ 200 chars) e conteúdo (sem caracteres de controle);
  inválido é descartado com WARN, mas não bloqueia a call.

> **Por que não trusted?** Se o LLM pudesse alucinar um `requestedBy: "admin"`
> e isso elevasse privilégio, viraria backdoor. O único sujeito que importa para
> decidir o que pode ser feito é o token da SA.

## Rotação do token da service account

O token da SA deve ser rotacionado periodicamente pelo operador:

1. Emitir novo token no provedor OIDC antes da expiração do atual.
2. Atualizar `MCP_SERVICE_ACCOUNT_TOKEN` no env do cliente MCP.
3. Reiniciar o cliente MCP (que respawna o processo BFin MCP).

Se o token expirar, o bootstrap falha com mensagem clara em stderr
(`MCP service account token expired` + `code: TOKEN_EXPIRED`) e o cliente MCP
perde a capacidade até a renovação.

## Auditoria

Todos os logs do MCP carregam `source: "mcp"` e, nas invocações de `tools/call`:

- `tool`: nome (ex.: `transactions.create`)
- `scope`: escopo exigido
- `acting_user_id`: o `MCP_SUBJECT_USER_ID`
- `outcome`: `success` ou `error`
- `duration_ms`
- `requested_by` (quando informado e válido)

Para separar writes vindos de MCP vs API HTTP, filtre em `logs.source = "mcp"`.
Alternativamente, as movimentações criadas via MCP sempre têm
`usuarioId = MCP_SUBJECT_USER_ID`.

## Limites conhecidos

- **Sem suporte a prompts/resources do MCP** nesta versão — apenas tools.
- **Sem HTTP/SSE** — apenas STDIO.
- **Token estático** — não implementamos `client_credentials` auto-renovável
  (follow-up).

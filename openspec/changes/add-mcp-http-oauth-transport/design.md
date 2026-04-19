## Context

O BFin hoje tem dois entrypoints sobre a mesma camada de services:

- **API HTTP** (`src/server.ts`) — Fastify com plugins `auth-guard` e `account-authorization`, autenticado via OIDC Google contra uma audience própria.
- **MCP server** (`src/mcp/server.ts`) — transporte STDIO, identidade fixa via `MCP_SERVICE_ACCOUNT_TOKEN` + `MCP_SUBJECT_USER_ID`, acesso direto ao Postgres.

O modo STDIO atende apenas clientes MCP locais (Claude Desktop, Cursor) e exige que o usuário clone o repo, faça build, cole uma credencial de banco e mantenha a sessão rodando localmente. Isso é incompatível com o objetivo do projeto: expor o BFin como **Remote Connector** em `claude.ai` (web/mobile), ChatGPT Apps, Cursor web, etc., onde o fluxo esperado é:

1. Usuário cola uma URL pública do connector
2. Cliente descobre o Authorization Server via metadata RFC 9728
3. Usuário faz OAuth (login Google → consent → redirect)
4. Cliente recebe access token e chama o MCP via HTTP+SSE

O spec aplicável é **MCP Auth `2025-06-18`**, que obriga o servidor MCP a agir como **OAuth 2.1 Resource Server** e delegar emissão de tokens a um Authorization Server externo.

**Constraints operacionais:**
- Projeto sobe em **nova VPS** com stack dedicada: `docker-compose.yml` novo contendo `api` (Fastify), `postgres`, `redis` e `caddy` (reverse proxy). Traefik não é usado.
- **Caddy** roteia exclusivamente `https://api.bfincont.com.br/mcp/*` → container `api` na fase inicial; demais rotas da API HTTP existem no código mas ficam internas (sem ingress público) até novos consumidores justificarem expor mais paths.
- DNS `api.bfincont.com.br` precisa apontar para o IP da nova VPS antes do primeiro start do Caddy (ACME falha sem DNS).
- Postgres roda dentro do compose da VPS (volumes persistentes), schema com tabela `usuarios` usando `id_provedor` como chave externa do IdP.
- Redis também dentro do compose — disponível sem nova infra externa.
- Sem k8s, sem múltiplas réplicas hoje (single VPS), mas arquitetura não deve impedir escala horizontal futura.

**Stakeholders:**
- Usuário final (plugando o connector no claude.ai e esperando o fluxo OAuth "simplesmente funcionar")
- Desenvolvedor (manter debug local fácil com MCP Inspector)
- Compliance (projeto financeiro — exige audit log e direito ao esquecimento LGPD)

## Goals / Non-Goals

**Goals:**

- Expor o MCP como Remote Connector acessível em `https://api.bfincont.com.br/mcp` compatível com `claude.ai → Settings → Connectors`
- Substituir identidade fixa (env vars) por identidade **por request** derivada do JWT OAuth
- Reutilizar integralmente a tool registry, authz e contexto MCP já existentes (só o transporte muda)
- Atender MCP Auth Spec `2025-06-18`: metadata RFC 9728, Bearer-only, `WWW-Authenticate` em 401, scopes mapeados
- Delegar toda a complexidade de AS (DCR, login social, consent, refresh, revogação) ao **Auth0** — zero código de AS no BFin
- Persistir sessões SSE em Redis pra sobreviver a restart e permitir escala horizontal futura
- Manter o audit log exigido por ser um projeto financeiro
- Suportar LGPD/GDPR com um comando operacional de remoção

**Non-Goals:**

- **Não manter** o transporte STDIO. O `src/mcp/server.ts` é deletado. Projeto ainda não tem usuário ativo em produção nesse modo, então breaking change é aceitável.
- **Não implementar** endpoints de AS próprios (nem DCR, nem `/token`, nem `/authorize`) — Auth0 faz tudo isso.
- **Não modificar** a API HTTP existente: rotas, plugins e audience continuam como estão. MCP tem audience própria.
- **Não suportar** múltiplos AS configuráveis por enquanto. Só Auth0.
- **Não entregar** UI própria de consent — o usuário vê o consent screen do Auth0.
- **Não entregar** migração automática de configuração STDIO pra HTTP. Usuário (desenvolvedor) precisa remover env vars antigas e seguir o guia novo.

## Decisions

### D1. Transporte: `StreamableHTTPServerTransport` do SDK oficial

**Escolha:** usar `StreamableHTTPServerTransport` exportado por `@modelcontextprotocol/sdk` (o mesmo SDK já importado pelo `buildMcpServer`).

**Por quê:** é o transporte oficial para MCP remoto. Mantém compatibilidade com qualquer cliente que implemente o spec sem que a gente precise codificar SSE manualmente. A tool registry existente pluga nele sem mudança.

**Alternativas consideradas:**
- Escrever um transporte SSE próprio sobre Fastify — mais trabalho e risco de incompatibilidade com clientes que seguem o spec à risca.
- Usar WebSocket — não é o transporte que os conectores do Claude falam.

### D2. Autorização: OAuth 2.1 Resource Server puro, AS externo (Auth0)

**Escolha:** BFin valida Bearer JWT, serve metadata RFC 9728, e delega emissão/DCR/social/consent ao Auth0.

**Por quê:** o spec MCP Auth obriga separação AS↔RS. Auth0 já suporta DCR nativo, Google como social, escopos customizados com descrições amigáveis em PT-BR no consent, revogação via console. Implementar AS próprio triplica o escopo de código e introduz superfície de segurança que a gente não quer manter.

**Alternativas consideradas:**
- **Keycloak self-hosted** — mais infra pra cuidar (DB, upgrade, backup) sem ganho funcional
- **Clerk/Supabase Auth** — DCR não é first-class em ambos
- **AS próprio minimalista** — rejeitado pelo custo de segurança/manutenção

### D3. Identidade por request: `sub` do JWT → `usuarios.id_provedor`

**Escolha:** cada request extrai `sub` do JWT validado; `loadServiceAccountFromToken({ token, validator, provisioning })` resolve `actingUserId` buscando `usuarios.id_provedor = sub`.

**Provisionamento automático** controlado por `MCP_PROVISIONING_ALLOWED_EMAILS`:
- Lista vazia → não provisiona; `sub` desconhecido retorna erro
- Email na allowlist → cria `usuarios` usando `name`/`email` das claims
- Email fora da allowlist → erro amigável

**Por quê:** reaproveita a convenção `id_provedor` que a API HTTP já usa. Allowlist evita que qualquer pessoa com conta Google crie usuário no banco, mas continua permitindo onboarding automático de stakeholders conhecidos.

**Alternativas consideradas:**
- **Invite-only**, sem provisionamento automático — pode virar fallback se a allowlist for insuficiente (capability `account-invite-system` já está planejada)
- **Mapear `email` em vez de `sub`** — rejeitado; email pode mudar, `sub` é imutável no Auth0

### D4. Scopes: mapeamento direto `scope` OAuth → `ReadonlySet<string>`

**Escolha:** as permissions criadas no Auth0 têm o mesmo nome dos scopes que o MCP já usa (`accounts:read`, `transactions:write`, etc.). Após validação, o campo `scope` (string separada por espaço) vira um `Set<string>` passado pro `McpContext`.

**Por quê:** zero tradução, zero divergência possível entre OAuth e interno. Se um dia surgir scope novo no MCP, adicionar no Auth0 é um clique.

**Trade-off:** se o Auth0 retornar scope que o MCP não conhece, ignoramos (log info). Se faltar scope obrigatório pra uma tool, o handler já rejeita — mesma lógica de hoje.

### D5. Session store: interface trocável, memória em dev + Redis em prod

**Escolha:** `src/mcp/session-store.ts` define a interface; duas implementações:
- `InMemorySessionStore` — default em dev; simples, sem dependência externa
- `RedisSessionStore` — default em prod; sobrevive a restart, permite escala horizontal

Seleção via `MCP_SESSION_STORE=memory|redis`.

**Por quê:** Redis já roda no compose. Em dev o overhead de subir Redis pra testar uma sessão é ruim; em prod perder todas as sessões a cada deploy é pior. Interface única evita código condicional no plugin.

**Alternativas consideradas:**
- **Só Redis** — obriga dev a subir Redis sempre. Descartado.
- **Só memória** — falha o requisito de resiliência a restart em prod. Descartado.
- **Postgres como store** — mais latência e cria hot-path de escrita num DB que queremos poupar. Descartado.

### D6. Tradução de erros de negócio → JSON-RPC

**Escolha:** `src/mcp/errors.ts` mapeia exceções de domínio (`BusinessRuleError`, `NotFoundError`, `SystemGeneratedResourceError`) pros códigos JSON-RPC padronizados do SDK MCP com mensagens amigáveis.

**Por quê:** erros brutos do Postgres/Prisma vazando pro cliente são ruins de duas formas — expõem internals e confundem o usuário final. O Claude mostra literalmente a mensagem ao usuário; então a mensagem precisa fazer sentido em PT-BR.

### D7. Audit log: `pino info` estruturado, um evento por tool call

**Escolha:** cada invocação de tool emite um log `info` estruturado com: `userId`, `sub`, `tool`, `scope`, `duration_ms`, `outcome` (`ok`/`error`), `input_hash` (sha256 do payload truncado), `error_code` se aplicável.

**Por quê:** projeto financeiro exige rastreabilidade. Pino já é o logger do Fastify; usar o mesmo formato evita nova stack. Hash do input preserva privacidade mas permite debug de padrões (mesmo input rejeitado 3 vezes → provável bug no cliente).

**Não logar:** valores de transações, descrições, nomes — só hash. Evita criar uma superfície PII nova nos logs.

### D8. Rate limit: buckets diferenciados via `@fastify/rate-limit`

**Escolha:** três buckets:
- **Metadata** (`/.well-known/*`) — permissivo (público, sem auth)
- **POST /mcp** — moderado por `sub` (token-aware, não por IP, pra não punir NAT)
- **GET /mcp/sse** — conservador por `sub` (uma sessão SSE consome socket)

**Por quê:** o spec MCP Auth menciona rate limit como mitigação de abuse. Sem buckets diferenciados, um cliente chato consome o orçamento de metadata e impede descoberta.

### D9. CORS: allowlist explícita restrita a `/mcp/*`

**Escolha:** `@fastify/cors` com origins `["https://claude.ai", "https://app.claude.com", "http://localhost:*"]`, aplicado **apenas** ao prefixo `/mcp/*`.

**Por quê:** sem CORS correto o browser do claude.ai nem consegue fazer preflight. Escopo no prefixo MCP evita afrouxar a API HTTP.

## Risks / Trade-offs

- **[Risco] Provisionamento automático cria usuários não autorizados** → Mitigação: `MCP_PROVISIONING_ALLOWED_EMAILS` obrigatória em prod; vazio = desabilitado; regex estreita em vez de wildcard.
- **[Risco] Auth0 fica indisponível → connector para de funcionar** → Mitigação: fora do escopo mitigar; cache de JWKS 10min reduz janela de dependência. Se for problema recorrente, avaliar AS self-hosted no futuro.
- **[Risco] Sessões Redis vazam memória se clientes não chamarem DELETE** → Mitigação: TTL em cada chave de sessão (default 1h de idle); renovado a cada atividade.
- **[Risco] `sub` do Auth0 muda entre tenants dev/prod** → Mitigação: allowlist e `id_provedor` são tenant-specific; documentar em `docs/mcp.md` que migrar tenant exige refazer o mapa.
- **[Risco] Logs de audit explodem em volume** → Mitigação: nível `info` (não `debug`), rotação já configurada no Pino padrão; sampling não é necessário no volume esperado (≤1k calls/dia).
- **[Trade-off] DCR aberto no Auth0 permite qualquer cliente MCP registrar** → Aceitamos: o gate real é o consent + allowlist de emails. Descoberta do endpoint não é segredo.
- **[Trade-off] Remover STDIO é breaking** → Aceitamos: zero usuários ativos em produção nesse modo hoje; manter dois transportes dobra manutenção.
- **[Trade-off] Rate limit por `sub` exige o token já validado antes do limit** → Aceitamos: custo CPU da verificação JWT é baixo (JWKS cache); inverter a ordem permite enumeração via 401 com IP anônimo.

## Migration Plan

1. **Auth0 setup** (steps 1.x de `tasks.md`) — tenant, API `Bfin MCP` com permissions, DCR habilitado, Google social. Pode ser feito e testado antes de mexer em código.
2. **Foundation code** (steps 2.x–3.x) — `bearer-auth`, `metadata`, `provisioning`, refactor de `identity.ts`. Cobertos por unit tests; sem impacto em produção.
3. **Plugin Fastify** (steps 4.x) — `mcp-http.ts` registrado no `server.ts`. Gate por `MCP_HTTP_ENABLED=false` em prod enquanto validando em dev.
4. **Remoção STDIO** (steps 5.x) — deletar `src/mcp/server.ts`, scripts, env vars antigas. Só após plugin HTTP validado localmente.
5. **Deploy** (steps 8.x) — atualizar `.env` na VPS, rebuild, smoke test via curl (metadata, 401, CORS preflight).
6. **Validação end-to-end** (steps 9.x) — MCP Inspector + claude.ai Connectors.

**Rollback:**
- Até passar o PR: reverter a branch, nenhum impacto.
- Após deploy com problema: `MCP_HTTP_ENABLED=false` + restart derruba só o plugin MCP; API HTTP segue. Sem rollback de schema necessário (não há migrations).
- Usuários provisionados durante validação que precisarem sumir: `npm run mcp:delete-user -- --email=<email>`.

## Open Questions

- **Allowlist inicial em prod:** quem entra primeiro? Proposta: email do dono + 2 devs durante semana de soft-launch, abrir depois.
- **Quota de tool calls por usuário/dia:** vale adicionar um bucket diário no rate limit pra evitar abuse acidental? Decidir após observar volume real nas primeiras 2 semanas.
- **Métricas Prometheus:** step 7.6 prevê extender `/metrics`. Confirmar nomes (`mcp_tool_calls_total`, `mcp_tool_duration_seconds`, `mcp_active_sessions`) antes de codificar pra não virar breaking em dashboards futuros.
- **Estratégia de teste E2E contínuo:** MCP Inspector é manual. Vale um job agendado chamando `initialize` + `tools/list` com token de dev pra detectar regressão de transporte? Fora do escopo deste change, candidato pra next.

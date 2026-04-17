## Context

A BFin é hoje uma API Fastify/TypeScript autenticada por OIDC (spec `oidc-integration`) com um `auth-guard` global (spec `auth-guard`) e autorização por conta via `requireAccountRole` (spec `account-authorization`, baseada em `conta_usuarios` com papéis `owner` | `viewer`). Os services do domínio (`account-service`, `category-service`, `transaction-service`, `debt-service`, `goal-service`, `daily-limit-service`, `projection-engine`) **não** validam pertencimento à conta por si — confiam que o `preHandler` HTTP já validou. Toda a lógica de identidade (user + claims OIDC) vive no hook `onRequest` do Fastify e é injetada em `request.user`.

Queremos adicionar um **segundo entrypoint** ao processo: um servidor MCP sobre STDIO + JSON-RPC 2.0 que exponha essas mesmas capacidades financeiras para clientes MCP (Claude Desktop, Claude Code, etc.). O MCP não pode simplesmente "virar root": precisa ser uma **service account** com escopos restritos, sem enfraquecer a autorização por conta nem confundir quem fez o quê na auditoria.

## Goals / Non-Goals

**Goals:**
- MCP server roda como processo Node separado, invocado pelo cliente MCP via STDIO, consumindo in-process os services/repositórios existentes (sem detour por HTTP).
- Identidade do MCP é uma **service account (SA)**: token OIDC validado no bootstrap contra o mesmo provedor do `oidc-integration`, tratado como agente de sistema.
- **Escopos finos** `resource:action` no token da SA (ex.: `transactions:write`, `accounts:read`). Cada tool declara o escopo necessário; o registry filtra `tools/list` e bloqueia `tools/call` quando o escopo não foi concedido.
- Autorização por conta continua válida: a SA resolve para um `userId` real da base; tools com `contaId` no input executam o mesmo check `conta_usuarios` usado no HTTP antes de chamar o service.
- **Contexto opcional** `metadata.requestedBy` aceito nas chamadas MCP e propagado apenas para o logger (campo estruturado `requested_by`); jamais usado em decisão de autorização.
- Separação clara de auditoria: todo log de tool MCP carrega `source: "mcp"` e, quando presente, `requested_by`. Logs HTTP existentes não mudam.
- Zero impacto na API HTTP em runtime: Fastify continua o mesmo; MCP é binário independente.

**Non-Goals:**
- MCP over HTTP/SSE (fora de escopo; o pedido é explicitamente STDIO + JSON-RPC).
- Prompts e resources do MCP (apenas tools nesta primeira versão; pode vir depois).
- Token de usuário final (não-SA) no MCP — autorização final sempre derivada dos escopos do SA; `requestedBy` é somente audit trail.
- Gestão/emissão do token da SA pelo próprio projeto (assume-se que o provedor OIDC emite o token com as claims/scopes corretos; docs descrevem como configurar).
- Rate-limiting específico do MCP nesta mudança (pode ser adicionado se/quando um cliente abusivo aparecer).
- Publicar o MCP como pacote npm público / bin global (a distribuição é via `node dist/mcp/server.js` ou `npx tsx src/mcp/server.ts` no repo).

## Decisions

### Decisão 1: Binário Node separado reutilizando services in-process (vs. cliente HTTP do próprio Fastify)
**Escolhido:** novo entrypoint `src/mcp/server.ts`, chamando as funções exportadas dos services diretamente.

**Rationale:** (a) O usuário pediu explicitamente binário separado; (b) in-process elimina o custo de um round-trip HTTP + autenticação para cada chamada; (c) reuso direto da camada de aplicação evita duplicar regras de negócio; (d) Fastify continua desacoplado — o MCP não importa de `src/app.ts` nem de `src/plugins/*`, apenas de `src/services/*`, `src/db/*` e dos caminhos compartilhados (`src/lib/*`).

**Alternativa considerada:** MCP chamando a API HTTP do próprio processo. Descartado por overhead e por obrigar a passar por `auth-guard` (que espera claims de usuário real, não de SA). Também considerado colocar tudo dentro do mesmo processo Fastify; descartado porque STDIO e HTTP são lifecycles diferentes (stdin/stdout do MCP precisa ficar limpo, sem logs misturados).

### Decisão 2: Usar `@modelcontextprotocol/sdk` oficial (vs. implementar JSON-RPC 2.0 à mão)
**Escolhido:** dependência `@modelcontextprotocol/sdk` (TypeScript SDK oficial do MCP) para o transport STDIO e para o handshake.

**Rationale:** O protocolo MCP tem versionamento (`protocolVersion`), capabilities, initialize handshake e mensagens `tools/list`/`tools/call` especificados. Implementar à mão é escopo de manutenção desnecessário. O SDK oficial é mantido pela Anthropic e tem o mesmo contrato que qualquer cliente MCP (Claude Desktop, Claude Code) espera.

**Alternativa:** implementar JSON-RPC 2.0 + framing manual. Descartado — custo de manutenção alto, risco de divergir do protocolo.

### Decisão 3: Service Account via token OIDC fornecido por env (vs. client_credentials flow no bootstrap)
**Escolhido:** token JWT fornecido em `MCP_SERVICE_ACCOUNT_TOKEN` (env), validado no bootstrap contra JWKS do provedor OIDC. Audiência obrigatória `MCP_OIDC_AUDIENCE`.

**Rationale:** (a) Simplicidade: o cliente MCP recebe o token pronto de quem configurar (operador, ou fluxo externo no provedor OIDC); (b) alinha com o `oidc-integration` existente (mesmo JWKS, mesma `jwtVerify`), não duplicando caminho; (c) mantém o MCP focado em validar o token, não em negociar fluxos OAuth; (d) token expirado ⇒ MCP não inicia (fail fast) — operador renova antes de relançar o processo.

**Alternativa:** MCP roda `client_credentials` no bootstrap para obter o próprio token. Descartado — adiciona dependência de secret de client nesse processo, complica docs e não é requisito agora. Pode virar opção futura.

### Decisão 4: Escopos no formato `resource:action` declarados na claim `scope` do token (padrão OAuth 2.0)
**Escolhido:** claim `scope` do token contendo lista separada por espaço de strings `resource:action` (ex.: `"accounts:read transactions:read transactions:write"`). Cada tool declara um `requiredScope` único.

**Resources/actions iniciais:**
- `accounts:read`, `accounts:write`
- `account-members:read`, `account-members:write`
- `categories:read`, `categories:write`
- `transactions:read`, `transactions:write`
- `debts:read`, `debts:write`
- `goals:read`, `goals:write`
- `daily-limit:read`, `daily-limit:write`
- `projections:read`

**Rationale:** (a) Alinhado com OAuth 2.0, formato que qualquer provedor OIDC suporta emitir; (b) granularidade "por domínio + ação" cobre o caso real sem explodir em 50 escopos; (c) `tools/list` filtrado por scope evita que o LLM sequer "veja" ferramentas para as quais não tem permissão — reduz chance de prompt injection pedir escalada; (d) `tools/call` com escopo insuficiente retorna erro JSON-RPC padronizado (`code: -32001`, nossa extensão "tool unauthorized").

**Alternativa:** escopos mais finos por tool (ex.: `transactions:create`, `transactions:delete`). Descartado por agora — começa granularidade por domínio+ação, evolui se surgir caso concreto.

### Decisão 5: `userId` da SA via env obrigatória, resolvido no bootstrap (vs. auto-provisionar)
**Escolhido:** `MCP_SUBJECT_USER_ID` (UUID do usuário na tabela `usuarios`) obrigatória. Bootstrap valida que o registro existe. Todas as writes são atribuídas a esse usuário.

**Rationale:** (a) A SA precisa ser um participante real de `conta_usuarios` para operar em uma conta — é impossível "agir em nome de ninguém"; (b) env explícita força o operador a criar o usuário SA na base e vincular às contas desejadas antes de rodar o MCP; (c) evita o anti-padrão de o MCP criar seu próprio usuário silenciosamente a cada restart; (d) facilita auditoria: filtrar `transacoes.criadoPor = <sa-user-id>` identifica tudo que veio via MCP.

**Alternativa:** usar `findOrCreateUser` com as claims do token (mesmo fluxo do HTTP). Descartado — mascara a SA como se fosse um usuário comum, dificulta separar "humanos" de "agentes" em relatórios.

### Decisão 6: Autorização por conta dentro da tool, não nos services (vs. mover checagem para os services)
**Escolhido:** manter `requireAccountRole` como responsabilidade do entrypoint (HTTP ou MCP). O MCP implementa um helper `assertAccountRole(userId, contaId, minRole)` em `src/mcp/authz.ts` que reusa a mesma query de `conta_usuarios` do plugin HTTP. Tool wrappers chamam esse helper antes de invocar o service.

**Rationale:** (a) Mantém retrocompatibilidade — serviços continuam sem mudar; (b) tornar o check responsabilidade do caller é consistente com o padrão atual; (c) evita risco de regressão em rotas existentes; (d) a lógica compartilhável é extraída para `src/lib/account-authorization.ts` (função pura) que ambos (plugin HTTP e helper MCP) importam — remove a duplicação sem acoplar camadas.

**Alternativa:** enforcer dentro dos services. Descartado — muda contrato de todos os services, refactor de maior escopo.

### Decisão 7: `metadata.requestedBy` apenas como audit context (vs. trust + bypass)
**Escolhido:** o servidor MCP aceita em qualquer `tools/call` um campo opcional `meta.requestedBy: string`. Esse valor NÃO participa de nenhuma decisão de autorização. Ele é:
- Anexado ao logger na invocação (pino child logger com `source: "mcp", tool, requested_by`).
- Incluído em mensagens de erro/success retornadas ao cliente MCP apenas via eco no log — não no payload de resposta.
- Validado apenas em tamanho/caracteres (ex.: string ≤ 200 chars, sem caracteres de controle) para não poluir logs.

**Rationale:** Exatamente o ponto de governança levantado — o token da SA concentra permissão, mas "quem pediu" fica rastreável para quando o operador precisa responder "isso veio do user X na conversa Y do cliente Z". Se `requestedBy` fosse trusted, vira backdoor (o LLM alucina um requestedBy "admin" e escalada silenciosa).

**Alternativa:** aceitar `requestedBy` como OIDC sub e elevar permissões de acordo. Descartado — contraria explicitamente a decisão do usuário de tratar o SA como service account.

### Decisão 8: Logger usa pino existente; stdin/stdout reservados para JSON-RPC
**Escolhido:** manter pino de `src/lib/logger.ts`, forçando toda saída de log para `stderr` dentro do processo MCP (pino aceita `destination: 2`). O framing JSON-RPC do MCP vive exclusivamente em stdin/stdout.

**Rationale:** (a) Obrigatório pelo protocolo: qualquer byte stray em stdout quebra o parse do cliente; (b) pino já é o padrão do projeto — manter consistência nos campos estruturados entre HTTP e MCP facilita observabilidade.

### Decisão 9: Entrypoint e scripts npm
**Escolhido:** novo arquivo `src/mcp/server.ts` com shebang `#!/usr/bin/env node` no artefato compilado. Scripts npm:
- `mcp:dev` → `tsx src/mcp/server.ts` (para teste local do operador; respeita regra do projeto de usar Docker para a API, mas MCP é processo one-shot STDIO invocado pelo cliente MCP — não é "dev server")
- `mcp:start` → `node dist/mcp/server.js` (consumido por clientes MCP apontando para o dist)

**Rationale:** MCP é ciclo stdin/stdout curto, ligado ao lifecycle do cliente MCP — não faz sentido rodar em Docker Compose para desenvolvimento, pois o cliente precisa ter o binário acessível no host. O `tsc --build` já cobre o novo diretório sem configuração extra (está em `src/`).

## Risks / Trade-offs

- **Risco:** Vazamento do `MCP_SERVICE_ACCOUNT_TOKEN` → atacante consegue agir como a SA. → **Mitigação:** (a) token com escopos mínimos necessários (nunca `*:*`); (b) documentação de rotação em `docs/mcp.md`; (c) token validado por audiência específica (`MCP_OIDC_AUDIENCE`), evitando reuso cruzado com tokens da API HTTP; (d) escopos dentro do token limitam superfície mesmo se o token vazar.
- **Risco:** `requestedBy` enviado pelo LLM é inventado (alucinação) e polui logs com IDs falsos. → **Mitigação:** explicitamente documentado em `docs/mcp.md` que o campo é "best-effort audit hint, não fonte de verdade"; relatórios de auditoria devem correlacionar por `source`+`tool`+`correlationId`, não por `requestedBy`. Validação básica de tamanho evita DoS via strings enormes.
- **Risco:** Desalinhamento futuro entre a lógica de `requireAccountRole` (HTTP) e `assertAccountRole` (MCP) → autorizações divergirem. → **Mitigação:** extrair função pura compartilhada para `src/lib/account-authorization.ts`; ambos entrypoints importam dela; testes cobrem os dois caminhos com os mesmos fixtures.
- **Risco:** Token da SA expira e o MCP para de subir — cliente MCP recebe erro de inicialização e LLM perde capacidade. → **Mitigação:** mensagem de erro do bootstrap clara (`MCP_SERVICE_ACCOUNT_TOKEN expired at <iso>`); docs orientam o operador a configurar renovação antes da expiração. Futuro: suporte a `client_credentials` auto-renovável (open question).
- **Risco:** Logging em stdout acidental (ex.: `console.log` residual) quebra JSON-RPC. → **Mitigação:** (a) lint rule ou teste que impede `console.*` em `src/mcp/`; (b) pino configurado com destination `stderr` explicitamente; (c) teste de smoke que inicia o servidor e faz um `tools/list`, falhando se stdout contém qualquer linha não-JSON-RPC.
- **Trade-off:** Tools replicam parte do marshalling que rotas HTTP fazem (mapear input zod → input do service, tratar erros para JSON-RPC). Aceitável pelo benefício de desacoplar entrypoints; a duplicação é pequena (cada tool tem ~20 linhas).
- **Trade-off:** Introduzir dependência `@modelcontextprotocol/sdk` (novo pacote, mantido pela Anthropic). Aceitável — alternativa é implementar e manter o protocolo manualmente, risco maior.

## Migration Plan

1. Introduzir `@modelcontextprotocol/sdk` em `dependencies` e extrair função de autorização de conta para `src/lib/account-authorization.ts` (refactor sem mudança de comportamento; plugin HTTP passa a importar dela).
2. Criar `src/mcp/identity.ts` (bootstrap + validação de token SA + escopos), `src/mcp/authz.ts` (scope check + account-role check), `src/mcp/rpc.ts` (wiring do SDK), `src/mcp/tools/*.ts` (uma tool por operação), `src/mcp/server.ts` (entrypoint).
3. Adicionar testes em `src/mcp/__tests__/` usando testcontainers (padrão do projeto) para: handshake, scope enforcement, `requestedBy` não eleva privilégio, integração end-to-end com ao menos um write e um read.
4. Adicionar `docs/mcp.md` com instruções de setup (registrar servidor no Claude Desktop, emitir token SA no provedor OIDC, vincular SA user à conta).
5. Adicionar scripts `mcp:start` e `mcp:dev` em `package.json`.
6. **Rollback:** o MCP é aditivo. Reverter é remover os novos arquivos + o script npm; API HTTP continua funcionando.

## Open Questions

- Devemos suportar o flow `client_credentials` para o SA auto-obter token, em vez de `MCP_SERVICE_ACCOUNT_TOKEN` estático? Deixado para follow-up — usuário decidiu começar simples.
- Precisamos expor `categories.create` via MCP? Categorias são sensíveis (afetam projeções e metas) e hoje algumas são `sistema: true`. Proposta: MCP tem `categories:read`; `categories:write` fica restrito a admin da conta (reuso do guard já existente) — confirmar no design detalhado das tools.
- Limite de payload por JSON-RPC call (para evitar que o LLM mande inputs gigantes)? Pino já trunca; podemos adicionar um `maxInputBytes` no rpc.ts. Proposta: 64 KiB por `params`. Abrir task se confirmado.
- Precisamos de um tool `whoami` devolvendo `{ serviceAccount: true, subject: "<sa-sub>", scopes: [...], actingAsUserId: "<uuid>" }` para debugging? Provavelmente sim — barato e ajuda o operador. Incluído nas tasks como opcional.

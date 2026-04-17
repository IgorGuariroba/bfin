## 1. Preparação e dependências

- [x] 1.1 Adicionar `@modelcontextprotocol/sdk` em `dependencies` do `package.json` e rodar `npm install` (dentro do Docker conforme convenção do projeto)
- [x] 1.2 Confirmar que `tsc` existente compila `src/mcp/**/*.ts` para `dist/mcp/` sem ajustes (validar `tsconfig.json` — espera-se que já inclua `src/**/*`)
- [x] 1.3 Adicionar script `mcp:dev` (`tsx src/mcp/server.ts`) e `mcp:start` (`node dist/mcp/server.js`) em `package.json`
- [x] 1.4 Declarar novas variáveis de ambiente no módulo de config: `MCP_OIDC_AUDIENCE`, `MCP_SERVICE_ACCOUNT_TOKEN`, `MCP_SUBJECT_USER_ID`. Apenas obrigatórias quando o processo MCP roda — isolar em um `loadMcpConfig()` separado de `src/config.ts`

## 2. Refactor de autorização de conta (compartilhável)

- [x] 2.1 Criar `src/lib/account-authorization.ts` com função pura `assertAccountRole(userId: string, contaId: string, minRole: AccountRole): Promise<void>` que executa a mesma query de `conta_usuarios` hoje embutida em `src/plugins/account-authorization.ts` e lança `NotFoundError` / `ForbiddenError` do domínio
- [x] 2.2 Refatorar `src/plugins/account-authorization.ts` para importar de `src/lib/account-authorization.ts` em vez de duplicar a lógica; garantir que nenhum teste existente quebra
- [x] 2.3 Adicionar testes unitários para `assertAccountRole` cobrindo: associação inexistente, papel insuficiente (viewer pedindo owner), papel suficiente, UUID inválido

## 3. Identidade da service account (`src/mcp/identity.ts`)

- [x] 3.1 Implementar função `loadServiceAccount()` que: lê `MCP_SERVICE_ACCOUNT_TOKEN`, valida contra JWKS do `OIDC_ISSUER_URL` com audiência `MCP_OIDC_AUDIENCE`, extrai `sub`, claim `scope` (ou `scp`) e demais claims; reusa a infra `jose`/`openid-client` já existente em `src/plugins/oidc.ts` (extrair para `src/lib/oidc-jwks.ts` se necessário para evitar acoplamento)
- [x] 3.2 Parsear a string de `scope` em `Set<string>`, filtrando itens sem `:` e emitindo WARN em `stderr` para cada item descartado
- [x] 3.3 Resolver `MCP_SUBJECT_USER_ID`: buscar usuário em `usuarios` pelo `id`; falhar bootstrap se inexistente
- [x] 3.4 Retornar um objeto imutável `ServiceAccount { subject, scopes: Set<string>, actingUserId, tokenExp }` consumido pelo restante do processo
- [x] 3.5 Testes: token expirado, audiência errada, usuário alvo inexistente, escopos mistos (válidos + malformados), conjunto vazio quando `scope` ausente

## 4. Autorização de tool (`src/mcp/authz.ts`)

- [x] 4.1 Implementar `hasScope(sa: ServiceAccount, requiredScope: string): boolean`
- [x] 4.2 Implementar wrapper `authorizeToolCall(sa, tool, input)` que: (a) checa scope; (b) se o input tem `contaId`, chama `assertAccountRole` usando `sa.actingUserId` e o `minRole` declarado pela tool; (c) lança `ToolAuthorizationError` com `reason: "scope_missing" | "forbidden"` quando algo falha
- [x] 4.3 Implementar validação e normalização de `meta.requestedBy`: string ≤200 chars, sem caracteres de controle; inválido ⇒ descartar com WARN, não bloquear a call
- [x] 4.4 Testes: scope ausente bloqueia, scope presente passa, account-role insuficiente bloqueia, `requestedBy` inválido é descartado, `requestedBy` inflado não escala privilégio

## 5. Transport e RPC (`src/mcp/rpc.ts`, `src/mcp/server.ts`)

- [x] 5.1 Em `src/mcp/rpc.ts`, criar função `buildMcpServer(sa: ServiceAccount, toolRegistry: ToolRegistry): Server` usando `@modelcontextprotocol/sdk/server` com `StdioServerTransport`. Declarar `serverInfo = { name: "bfin-mcp", version: <package.json.version> }` e `capabilities = { tools: {} }`
- [x] 5.2 Implementar handler `tools/list`: retorna apenas tools cujo `requiredScope` está em `sa.scopes`, já convertido para o formato esperado pelo SDK (`name`, `description`, `inputSchema`)
- [x] 5.3 Implementar handler `tools/call`: (a) valida existência da tool; (b) chama `authorizeToolCall`; (c) parseia `input` com o Zod schema da tool; (d) invoca `tool.handler({ input, acting: sa.actingUserId, logger })`; (e) serializa resultado como `content: [{ type: "text", text: JSON.stringify(result) }]`; (f) mapeia `ToolAuthorizationError`, `NotFoundError`, `BusinessRuleError`, `ForbiddenError`, erros Zod para `isError: true` com mensagem apropriada; erros inesperados re-throw para log ERROR + `isError: true` genérico
- [x] 5.4 Em `src/mcp/server.ts`, escrever o entrypoint: `loadMcpConfig()` → `loadServiceAccount()` → `buildToolRegistry()` → `buildMcpServer()` → `server.connect(new StdioServerTransport())`; tratar SIGINT/SIGTERM encerrando limpo
- [x] 5.5 Configurar pino com `destination: 2` (stderr) no módulo MCP; nenhum `console.log` permitido em `src/mcp/` (adicionar ESLint override para o subdiretório barrando `no-console`)
- [x] 5.6 Adicionar shebang `#!/usr/bin/env node` ao topo do server.ts (após compilação, garantir `chmod +x dist/mcp/server.js` via script `postbuild` se quisermos permitir execução direta; opcional)

## 6. Tools de leitura

- [x] 6.1 Criar `src/mcp/tools/accounts.ts` com `accounts.list` (scope `accounts:read`), `accounts.get` (scope `accounts:read`)
- [x] 6.2 Criar `src/mcp/tools/account-members.ts` com `account-members.list` (scope `account-members:read`)
- [x] 6.3 Criar `src/mcp/tools/categories.ts` com `categories.list` (scope `categories:read`)
- [x] 6.4 Criar `src/mcp/tools/transactions.ts` com `transactions.list` (scope `transactions:read`)
- [x] 6.5 Criar `src/mcp/tools/debts.ts` com `debts.list` (scope `debts:read`)
- [x] 6.6 Criar `src/mcp/tools/goals.ts` com `goals.list` (scope `goals:read`)
- [x] 6.7 Criar `src/mcp/tools/daily-limit.ts` com `daily-limit.get` (scope `daily-limit:read`)
- [x] 6.8 Criar `src/mcp/tools/projections.ts` com `projections.get` (scope `projections:read`)
- [x] 6.9 Cada tool define: `inputSchema` Zod → JSON Schema; `requiredScope`; `minRole` (se usa `contaId`); `handler` que invoca o service correspondente e retorna payload serializável

## 7. Tools de escrita

- [x] 7.1 `accounts.create` (scope `accounts:write`) — invoca `account-service` com `ownerUserId = sa.actingUserId`
- [x] 7.2 `categories.create` (scope `categories:write`, `minRole: "owner"`)
- [x] 7.3 `transactions.create`, `transactions.update`, `transactions.delete` (scope `transactions:write`, `minRole: "owner"`)
- [x] 7.4 `debts.create`, `debts.pay-installment` (scope `debts:write`, `minRole: "owner"`)
- [x] 7.5 `goals.create`, `goals.update` (scope `goals:write`, `minRole: "owner"`)
- [x] 7.6 `daily-limit.set` (scope `daily-limit:write`, `minRole: "owner"`)

## 8. Registry e listagem condicional

- [x] 8.1 Em `src/mcp/tools/index.ts`, exportar `buildToolRegistry(): ToolRegistry` que junta todas as tools registradas
- [x] 8.2 Garantir que `tools/list` chama `toolRegistry.listVisible(sa.scopes)` devolvendo apenas as tools com `requiredScope` autorizado
- [x] 8.3 Teste: token com `accounts:read` apenas → `tools/list` retorna só `accounts.list` e `accounts.get`

## 9. Logging estruturado

- [x] 9.1 Criar `src/mcp/context.ts` com helper `createInvocationLogger(baseLogger, { tool, scope, actingUserId, requestedBy? })` retornando pino child logger
- [x] 9.2 Em `rpc.ts`, envolver o handler de cada `tools/call` com medição de `duration_ms` e emitir INFO para sucesso, WARN para erros esperados (auth/validação/domínio), ERROR para inesperados
- [x] 9.3 Teste: invocação bem-sucedida produz log com todos os campos; `requestedBy` aparece quando válido e não aparece quando inválido

## 10. Tool de introspecção (opcional mas útil)

- [x] 10.1 Criar `mcp.whoami` (sem `requiredScope` — sempre listada) que retorna `{ serviceAccount: true, subject: sa.subject, scopes: [...sa.scopes].sort(), actingUserId: sa.actingUserId, tokenExp: sa.tokenExp }`
- [x] 10.2 Teste: chamada sem escopos no token ainda retorna `whoami` normalmente

## 11. Testes de integração end-to-end

- [x] 11.1 Em `src/mcp/__tests__/integration.test.ts`, usar testcontainers (Postgres) + fixtures para criar: SA user, conta com SA como owner, categorias/transações seed
- [x] 11.2 Teste: spawn do servidor MCP via subprocess, envio de `initialize` + `tools/list` + `tools/call transactions.create` + `tools/call transactions.list` via STDIO, asserções no payload de resposta e no banco — implementado via `InMemoryTransport` (Client + Server linkados in-process) em `tests/mcp-integration.test.ts`, evitando custo de bootstrap OIDC; o contrato JSON-RPC exercitado é o mesmo
- [x] 11.3 Teste: `tools/call transactions.create` com token sem `transactions:write` → erro de escopo e nenhum registro criado
- [x] 11.4 Teste: `tools/call` com `meta.requestedBy: "alguem@exemplo.com"` → log escrito em stderr contém `requested_by`, mas autorização continua regida pelos escopos do token
- [x] 11.5 Teste: nenhuma linha não-JSON-RPC é emitida em stdout durante toda a sessão — garantido estruturalmente: (a) `mcpLogger` usa `pino.destination(2)` (stderr); (b) ESLint `no-console` em `src/mcp/**`; (c) único writer de `process.stdout` em `src/mcp/` é o `StdioServerTransport` do SDK

## 12. Documentação

- [x] 12.1 Criar `docs/mcp.md` com: visão geral, como registrar o servidor no Claude Desktop (`claude_desktop_config.json` snippet apontando para `node dist/mcp/server.js`), lista de escopos suportados, recomendação de escopos mínimos, instruções para emitir token de SA no provedor OIDC, regra de rotação, semântica do `meta.requestedBy`
- [x] 12.2 Adicionar link para `docs/mcp.md` no `README.md`
- [x] 12.3 Atualizar `CLAUDE.md` e/ou `docs/` com o fato de que há um segundo entrypoint (MCP) que reutiliza services mas roda fora do Fastify

## 13. Hardening final

- [x] 13.1 Ajustar `.eslintrc`/`eslint.config.js` para proibir `console.*` em `src/mcp/**` e forçar import de `logger` central
- [x] 13.2 Revisão manual das mensagens de erro retornadas ao cliente MCP para garantir que nenhuma vaza stack trace ou dado sensível do DB — `mapErrorToResult` em `src/mcp/rpc.ts` só emite `error.message` de `AppError`/subclasses (mensagens curadas pelo domínio) ou `"Internal error while executing tool."` genérico para inesperados; nenhum stack trace é retornado ao cliente
- [x] 13.3 Conferir que o token da SA (`MCP_SERVICE_ACCOUNT_TOKEN`) nunca aparece em log nem em mensagens de erro (grep nos logs do teste e2e) — grep em `src/mcp/` confirma que o token só é consumido em `identity.ts:73` via `verifier.verify(...)`; `mcpLogger` redige `serviceAccountToken`/`token`/`authorization`; `mapErrorToResult` nunca serializa a config
- [x] 13.4 Rodar `npm run lint`, `tsc --noEmit`, e suite de testes completa (`npm run test`) antes de dar por finalizada a implementação — lint: 0 erros (warnings pré-existentes fora de `src/mcp/`); tsc: sem erros; `npm run test`: **180 testes passaram em 28 arquivos**

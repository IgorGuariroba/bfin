## MODIFIED Requirements

### Requirement: Entrypoint HTTP+SSE JSON-RPC 2.0
O projeto SHALL fornecer o transporte MCP como plugin Fastify registrado em `src/plugins/mcp-http.ts` sobre o processo HTTP principal (`src/server.ts`). O transporte SHALL ser `StreamableHTTPServerTransport` do `@modelcontextprotocol/sdk`, exposto sob o prefixo `/mcp` e autenticado via OAuth 2.1 Bearer. Logs estruturados SHALL ser emitidos pelo Pino do Fastify (não mais exclusivamente em `stderr` — a regra antiga de isolamento de `stdout` era específica do STDIO).

#### Scenario: Cliente remoto conecta via HTTP
- **WHEN** um cliente MCP (ex.: claude.ai Connector) envia `POST /mcp` com `initialize` e Bearer válido
- **THEN** o servidor completa o handshake declarando capabilities `tools: {}` e fica pronto para `tools/list`

#### Scenario: Mensagem JSON-RPC mal-formada
- **WHEN** o cliente envia body que não é JSON-RPC 2.0 válido
- **THEN** o servidor responde com erro `-32700` (Parse error) ou `-32600` (Invalid Request), sem derrubar o processo

### Requirement: Handshake e versionamento MCP
O servidor SHALL implementar o handshake `initialize` do protocolo MCP, anunciando `serverInfo` (`name: "bfin-mcp"`, versão do `package.json`) e `capabilities.tools = {}`. O servidor SHALL rejeitar clientes com `protocolVersion` incompatível com o SDK instalado. Este requisito é transporte-agnóstico — o comportamento SHALL ser idêntico ao modelo STDIO anterior.

#### Scenario: Cliente com versão suportada
- **WHEN** o cliente envia `initialize` com `protocolVersion` suportado pelo SDK
- **THEN** o servidor responde com `serverInfo: { name: "bfin-mcp", version: <npm version> }` e `capabilities.tools: {}`

#### Scenario: Cliente com versão incompatível
- **WHEN** o cliente envia `initialize` com `protocolVersion` não suportado
- **THEN** o servidor retorna erro JSON-RPC indicando incompatibilidade e encerra a sessão sem processar tools

### Requirement: Registry de tools por domínio
O servidor SHALL registrar tools MCP organizadas por domínio, cobrindo leitura e escrita das capacidades da BFin. Cada tool SHALL declarar: `name` no formato `<domain>.<action>`, `description`, `inputSchema` (JSON Schema derivado de Zod), `requiredScope` (string `resource:action`) e handler. A registry é reutilizada integralmente do código existente — o transporte HTTP não altera a lista de tools.

#### Scenario: tools/list retorna apenas tools autorizadas
- **WHEN** o cliente chama `tools/list` com Bearer contendo scopes específicos
- **THEN** o servidor retorna apenas as tools cujo `requiredScope` está no conjunto de scopes do token da **request atual** (não mais de um token global)

#### Scenario: Domínios cobertos
- **WHEN** o servidor é consultado por token com todos os escopos concedidos
- **THEN** `tools/list` inclui pelo menos: `accounts.list`, `accounts.get`, `accounts.create`, `account-members.list`, `categories.list`, `categories.create`, `transactions.list`, `transactions.create`, `transactions.update`, `transactions.delete`, `debts.list`, `debts.create`, `debts.pay-installment`, `goals.list`, `goals.create`, `goals.update`, `daily-limit.get`, `daily-limit.set`, `projections.get`

#### Scenario: Tool sem escopo no token é ocultada
- **WHEN** o token da request inclui `transactions:read` mas não `transactions:write`
- **THEN** `tools/list` mostra `transactions.list` mas não `transactions.create`/`update`/`delete`

### Requirement: Execução de tool via tools/call
O servidor SHALL implementar `tools/call` chamando o service correspondente do domínio in-process. O handler SHALL validar o input com Zod antes de invocar o service e SHALL mapear exceções do domínio (`NotFoundError`, `BusinessRuleError`, `ForbiddenError`, `SystemGeneratedResourceError`) para erros JSON-RPC padronizados usando `src/mcp/errors.ts`.

#### Scenario: Invocação bem-sucedida
- **WHEN** o cliente chama `tools/call` com uma tool autorizada e input válido
- **THEN** o servidor executa o service, retorna `content: [{ type: "text", text: <JSON do resultado> }]` e `isError: false`

#### Scenario: Input inválido segundo o schema
- **WHEN** o cliente chama `tools/call` com input que não passa na validação Zod
- **THEN** o servidor retorna `isError: true` com mensagem descrevendo o campo inválido em PT-BR, sem invocar o service

#### Scenario: Domínio lança NotFoundError
- **WHEN** a tool `transactions.update` é chamada com um `transactionId` inexistente
- **THEN** o servidor retorna `isError: true` com código `-32001` e mensagem traduzida

#### Scenario: Domínio lança ForbiddenError por autorização de conta
- **WHEN** a tool é chamada com `contaId` onde o usuário da request não tem papel suficiente
- **THEN** o servidor retorna `isError: true` com código `-32003` e mensagem genérica de permissão, sem expor detalhes internos

### Requirement: Scripts npm e artefato de build
O `package.json` SHALL **não** expor mais os scripts `mcp:dev` nem `mcp:start`. O MCP roda como parte do processo Fastify principal iniciado por `npm run dev`/`npm run start`. O `tsc` existente SHALL continuar compilando `src/mcp/**/*.ts` como dependência in-process do `src/server.ts`.

#### Scenario: Execução em desenvolvimento
- **WHEN** o operador executa `npm run dev`
- **THEN** o Fastify sobe com o plugin MCP registrado; o endpoint `POST /mcp` responde ao handshake

#### Scenario: Execução em produção
- **WHEN** `npm run build` é executado seguido por `npm run start`
- **THEN** o processo Fastify compilado serve tanto a API HTTP quanto o MCP no mesmo processo

### Requirement: Logging estruturado por invocação
Toda invocação de `tools/call` SHALL gerar um log estruturado (pino `info`) com campos mínimos: `event: "mcp.tool_call"`, `source: "mcp"`, `tool`, `scope`, `user_id` (acting user da request), `sub` (claim do token), `outcome` (`"ok"` ou `"error"`), `duration_ms`, `input_hash`, `error_code` (quando erro). Quando presente e válido, `meta.requestedBy` SHALL ser anexado como `requested_by`, sem participar de autorização.

#### Scenario: Log de sucesso
- **WHEN** uma tool é executada com sucesso
- **THEN** um log INFO é emitido pelo pino do Fastify com `event: "mcp.tool_call"`, `outcome: "ok"`, `duration_ms`, `input_hash`

#### Scenario: Log com requested_by
- **WHEN** o cliente envia `tools/call` com `meta.requestedBy: "user-abc"`
- **THEN** o log inclui `requested_by: "user-abc"`; a decisão de autorização permanece baseada exclusivamente nos escopos do token da request

#### Scenario: Log de erro inclui causa
- **WHEN** uma tool falha (validação, autorização, erro de domínio, erro inesperado)
- **THEN** um log é emitido com `outcome: "error"` e `error_code` (mapeado via `src/mcp/errors.ts`); para erros inesperados, um log `error` adicional inclui o stack

## REMOVED Requirements

### Requirement: Entrypoint STDIO JSON-RPC 2.0
**Reason**: O transporte STDIO não atende ao objetivo do projeto (BFin como Remote Connector em clientes LLM web/mobile). O spec MCP Auth `2025-06-18` exige transporte HTTP+SSE com OAuth.

**Migration**: Clientes que usavam `node dist/mcp/server.js` precisam migrar para conectar via `https://api.bfincont.com.br/mcp` usando OAuth 2.1. Não há caminho de compatibilidade — STDIO é descontinuado. Documentação em `docs/mcp.md` descreve o novo fluxo.

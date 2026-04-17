# mcp-server

## Purpose

Provê um segundo entrypoint ao processo BFin: um servidor MCP (Model Context Protocol)
sobre STDIO + JSON-RPC 2.0 que expõe as capacidades financeiras do domínio
(accounts, categories, transactions, debts, goals, projections, daily-limit) como
*tools* para clientes MCP (Claude Desktop, Claude Code, etc.), reutilizando in-process
os mesmos services da camada de aplicação usados pela API HTTP — sem detour por HTTP
e sem depender do Fastify.

## Requirements

### Requirement: Entrypoint STDIO JSON-RPC 2.0
O projeto SHALL fornecer um entrypoint Node em `src/mcp/server.ts` que implementa o protocolo MCP sobre STDIO + JSON-RPC 2.0 usando `@modelcontextprotocol/sdk`. O processo SHALL reservar `stdin`/`stdout` exclusivamente para mensagens do protocolo e escrever toda saída de log em `stderr`.

#### Scenario: Processo iniciado por cliente MCP
- **WHEN** um cliente MCP (ex.: Claude Desktop) spawna o binário MCP via STDIO
- **THEN** o servidor completa o handshake `initialize` com `protocolVersion` compatível, declara capabilities (`tools: {}`) e fica pronto para receber requisições

#### Scenario: Log acidental em stdout é bloqueado
- **WHEN** algum código interno tenta escrever em `process.stdout` fora do caminho do SDK
- **THEN** o servidor SHALL falhar no bootstrap ou redirecionar a saída para `stderr`, garantindo que nenhum byte não-protocolo chegue ao cliente MCP

#### Scenario: Mensagem JSON-RPC mal-formada
- **WHEN** o cliente envia um frame que não é JSON-RPC 2.0 válido
- **THEN** o servidor responde com erro padrão `-32700` (Parse error) ou `-32600` (Invalid Request) conforme o protocolo, sem derrubar o processo

### Requirement: Handshake e versionamento MCP
O servidor SHALL implementar o handshake `initialize` do protocolo MCP, anunciando `serverInfo` (nome `bfin-mcp` e versão do `package.json`) e `capabilities.tools = {}`. O servidor SHALL rejeitar clientes com `protocolVersion` incompatível com o SDK instalado.

#### Scenario: Cliente com versão suportada
- **WHEN** o cliente envia `initialize` com `protocolVersion` suportado pelo SDK
- **THEN** o servidor responde com `serverInfo: { name: "bfin-mcp", version: <npm version> }` e `capabilities.tools: {}`

#### Scenario: Cliente com versão incompatível
- **WHEN** o cliente envia `initialize` com `protocolVersion` não suportado
- **THEN** o servidor retorna erro JSON-RPC indicando incompatibilidade e encerra a sessão sem processar tools

### Requirement: Registry de tools por domínio
O servidor SHALL registrar tools MCP organizadas por domínio, cobrindo leitura e escrita das capacidades da BFin. Cada tool SHALL declarar: `name` no formato `<domain>.<action>`, `description`, `inputSchema` (JSON Schema derivado de Zod), `requiredScope` (string `resource:action`) e handler.

#### Scenario: tools/list retorna apenas tools autorizadas
- **WHEN** o cliente chama `tools/list`
- **THEN** o servidor retorna apenas as tools cujo `requiredScope` está presente no conjunto de escopos do token da service account

#### Scenario: Domínios cobertos
- **WHEN** o servidor inicia com todos os escopos concedidos
- **THEN** `tools/list` inclui pelo menos: `accounts.list`, `accounts.get`, `accounts.create`, `account-members.list`, `categories.list`, `categories.create`, `transactions.list`, `transactions.create`, `transactions.update`, `transactions.delete`, `debts.list`, `debts.create`, `debts.pay-installment`, `goals.list`, `goals.create`, `goals.update`, `daily-limit.get`, `daily-limit.set`, `projections.get`

#### Scenario: Tool sem escopo no token é ocultada
- **WHEN** o token da service account não inclui `transactions:write` mas inclui `transactions:read`
- **THEN** `tools/list` mostra `transactions.list` mas não `transactions.create`/`update`/`delete`

### Requirement: Execução de tool via tools/call
O servidor SHALL implementar `tools/call` chamando o service correspondente do domínio in-process. O handler SHALL validar o input com Zod antes de invocar o service e SHALL mapear exceções do domínio (`NotFoundError`, `BusinessRuleError`, `ForbiddenError`) para erros JSON-RPC padronizados.

#### Scenario: Invocação bem-sucedida
- **WHEN** o cliente chama `tools/call` com uma tool autorizada e input válido
- **THEN** o servidor executa o service, retorna `content: [{ type: "text", text: <JSON do resultado> }]` e `isError: false`

#### Scenario: Input inválido segundo o schema
- **WHEN** o cliente chama `tools/call` com input que não passa na validação Zod
- **THEN** o servidor retorna `isError: true` com mensagem descrevendo o campo inválido, sem invocar o service

#### Scenario: Domínio lança NotFoundError
- **WHEN** a tool `transactions.update` é chamada com um `transactionId` inexistente
- **THEN** o servidor retorna `isError: true` com `content` indicando not found, sem derrubar o processo

#### Scenario: Domínio lança ForbiddenError por autorização de conta
- **WHEN** a tool é chamada com `contaId` onde o usuário da service account não tem papel suficiente
- **THEN** o servidor retorna `isError: true` com mensagem de forbidden, sem expor detalhes internos

### Requirement: Scripts npm e artefato de build
O `package.json` SHALL expor dois scripts: `mcp:dev` (`tsx src/mcp/server.ts`) para execução direta do source e `mcp:start` (`node dist/mcp/server.js`) para execução pós-build. O `tsc` existente SHALL compilar `src/mcp/**/*.ts` para `dist/mcp/` sem configuração adicional.

#### Scenario: Execução em desenvolvimento
- **WHEN** o operador executa `npm run mcp:dev`
- **THEN** `tsx` inicia `src/mcp/server.ts`, o servidor faz handshake via STDIO e fica pronto para `tools/list`

#### Scenario: Execução em produção
- **WHEN** `npm run build` é executado seguido por `npm run mcp:start`
- **THEN** `node dist/mcp/server.js` inicia o servidor MCP com o mesmo comportamento do modo dev

### Requirement: Logging estruturado por invocação
Toda invocação de `tools/call` SHALL gerar um log estruturado com campos mínimos: `source: "mcp"`, `tool: <name>`, `scope: <requiredScope>`, `acting_user_id: <MCP_SUBJECT_USER_ID>`, `outcome: "success" | "error"`, `duration_ms`. Quando presente, o campo `meta.requestedBy` SHALL ser anexado como `requested_by` ao log, sem participar de autorização.

#### Scenario: Log de sucesso
- **WHEN** uma tool é executada com sucesso
- **THEN** um log INFO é emitido em stderr com `source: "mcp"`, `tool`, `outcome: "success"`, `duration_ms`

#### Scenario: Log com requested_by
- **WHEN** o cliente envia `tools/call` com `meta.requestedBy: "user-abc"`
- **THEN** o log inclui `requested_by: "user-abc"` mas a decisão de autorização permanece baseada exclusivamente nos escopos do token

#### Scenario: Log de erro inclui causa
- **WHEN** uma tool falha (validação, autorização, erro de domínio)
- **THEN** um log em nível apropriado (WARN para 4xx-equivalentes, ERROR para inesperados) é emitido com `outcome: "error"` e a classe/código do erro

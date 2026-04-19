## ADDED Requirements

### Requirement: Mapeamento de exceções de domínio para códigos JSON-RPC
O sistema SHALL traduzir exceções lançadas pelos services de domínio para erros JSON-RPC 2.0 retornados ao cliente MCP, usando mensagens amigáveis em PT-BR. O mapeamento SHALL estar centralizado em `src/mcp/errors.ts` e ser aplicado em todo handler de tool.

Mapeamento mínimo:
- `NotFoundError` → `-32001 RESOURCE_NOT_FOUND` com mensagem do domínio
- `BusinessRuleError` → `-32002 BUSINESS_RULE_VIOLATION` com regra descrita
- `ForbiddenError` → `-32003 FORBIDDEN` com mensagem genérica de permissão
- `SystemGeneratedResourceError` → `-32004 SYSTEM_GENERATED_RESOURCE` (ex.: tentar editar categoria do sistema)
- Erros não mapeados → `-32603 INTERNAL_ERROR` com mensagem genérica (detalhe vai pro log, não pro cliente)

#### Scenario: NotFoundError traduzido
- **WHEN** `transactions.update` é chamada com `transactionId` inexistente e o service lança `NotFoundError("Transaction not found")`
- **THEN** a resposta JSON-RPC contém `{"error": {"code": -32001, "message": "Transaction not found"}}` com `isError: true`

#### Scenario: BusinessRuleError traduzido
- **WHEN** `transactions.create` viola regra de saldo mínimo e o service lança `BusinessRuleError("Saldo insuficiente para a operação")`
- **THEN** a resposta contém `{"error": {"code": -32002, "message": "Saldo insuficiente para a operação"}}`

#### Scenario: ForbiddenError traduzido
- **WHEN** a tool é chamada com `contaId` onde o usuário não tem papel suficiente e o service lança `ForbiddenError`
- **THEN** a resposta contém `{"error": {"code": -32003, "message": "Você não tem permissão para executar essa operação nesta conta"}}` — mensagem genérica, sem vazar detalhes de roles

#### Scenario: Erro não mapeado vira internal
- **WHEN** o service lança um `Error` genérico (ex.: falha de DB)
- **THEN** a resposta contém `{"error": {"code": -32603, "message": "Erro interno ao processar a operação"}}` e o stack completo vai para o log ERROR

### Requirement: Mensagens de erro em PT-BR amigáveis ao usuário final
Todas as mensagens de erro retornadas pelo MCP SHALL estar em português brasileiro, escritas com o usuário final do Claude em mente (sem jargão técnico, sem nomes de colunas/tabelas, sem stack traces). Códigos e detalhes técnicos SHALL ficar apenas no log estruturado.

#### Scenario: Mensagem não vaza detalhe interno
- **WHEN** um erro do Prisma `P2002 unique constraint violation on column "email"` é lançado
- **THEN** a resposta ao cliente é `{"code": -32002, "message": "Já existe um registro com esses dados"}` — nunca o texto original do Prisma

#### Scenario: Campo específico da validação aparece
- **WHEN** input falha na validação Zod em `campo.valor` por estar abaixo de zero
- **THEN** a mensagem é clara como `"O campo 'valor' deve ser maior ou igual a zero"` em vez do texto cru do Zod em inglês

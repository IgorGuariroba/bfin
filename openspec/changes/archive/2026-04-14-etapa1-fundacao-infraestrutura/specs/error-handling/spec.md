# error-handling Specification

## Purpose
Padronizar o tratamento e a estrutura de respostas de erro da API, garantindo rastreabilidade, códigos de erro consistentes e classes tipadas reutilizáveis em toda a base.

## Requirements

### Requirement: Estrutura padrão de erro
Todas as respostas de erro da API SHALL seguir a estrutura JSON: `{ "timestamp", "requestId", "message", "code" }`.

#### Scenario: Erro de regra de negócio
- **WHEN** uma regra de negócio é violada (ex: valor negativo)
- **THEN** a resposta MUST retornar status 422 com body contendo `timestamp` (ISO 8601), `requestId` da request atual, `message` descritiva e `code` igual a `BUSINESS_RULE_VIOLATION`

#### Scenario: Recurso não encontrado
- **WHEN** um recurso inexistente é solicitado
- **THEN** a resposta MUST retornar status 404 com `code` igual a `RESOURCE_NOT_FOUND`

#### Scenario: Permissão insuficiente
- **WHEN** um usuário tenta uma operação sem permissão
- **THEN** a resposta MUST retornar status 403 com `code` igual a `INSUFFICIENT_PERMISSIONS`

### Requirement: Códigos de erro de negócio
O sistema SHALL suportar os seguintes códigos de erro: `BUSINESS_RULE_VIOLATION`, `INSUFFICIENT_PERMISSIONS`, `RESOURCE_NOT_FOUND`, `DUPLICATE_RESOURCE`, `ALREADY_PAID`, `RESOURCE_IN_USE`, `SYSTEM_GENERATED_RESOURCE`, `DEBT_HAS_PAYMENTS`, `CASCADE_DEPTH_EXCEEDED`.

#### Scenario: Código de erro reconhecido
- **WHEN** uma exceção de negócio é lançada com um código definido
- **THEN** o error handler MUST incluir o código no campo `code` da resposta

### Requirement: Classes de erro tipadas
O sistema SHALL fornecer classes de erro (ex: `BusinessRuleError`, `NotFoundError`, `ForbiddenError`, `DuplicateError`) que encapsulam `statusCode`, `code` e `message`.

#### Scenario: BusinessRuleError
- **WHEN** um `BusinessRuleError` é lançado com message "Valor deve ser positivo"
- **THEN** o error handler MUST retornar status 422 com `code: "BUSINESS_RULE_VIOLATION"` e `message: "Valor deve ser positivo"`

#### Scenario: Erro inesperado
- **WHEN** um erro não tipado (ex: TypeError) é lançado
- **THEN** o error handler MUST retornar status 500 com `code: "INTERNAL_ERROR"` e `message` genérica, sem expor detalhes internos

### Requirement: Error handler global
O Fastify SHALL registrar um `setErrorHandler` global que intercepta todas as exceções e as converte no formato padronizado.

#### Scenario: Validação de schema Fastify
- **WHEN** o Fastify rejeita uma request por falha na validação de schema (ex: campo obrigatório ausente)
- **THEN** o error handler MUST retornar status 400 com `code: "VALIDATION_ERROR"` e `message` descritiva

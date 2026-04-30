## ADDED Requirements

### Requirement: Geração de OpenAPI a partir de schemas Zod
O sistema SHALL gerar uma especificação OpenAPI 3.x dinâmica derivada dos schemas Zod declarados nas rotas Fastify, usando `fastify-type-provider-zod` + `@fastify/swagger`. A spec SHALL refletir validação runtime sem drift.

#### Scenario: Rota declara request/response com Zod
- **WHEN** uma rota declara `schema: { body: zSchema, response: { 200: zResponse } }` usando o type provider Zod
- **THEN** a entrada correspondente em `/openapi.json` contém o JSON Schema equivalente, incluindo enums, descrições e required fields

#### Scenario: Adição de nova rota
- **WHEN** uma nova rota com schema Zod é registrada no Fastify
- **THEN** ela aparece automaticamente em `/openapi.json` no próximo restart, sem edição manual de YAML

### Requirement: Endpoint público /openapi.json
O sistema SHALL expor a spec OpenAPI em `GET /openapi.json` sem exigir autenticação, retornando JSON `application/json` com a spec completa.

#### Scenario: Fetch público da spec
- **WHEN** um cliente faz `GET /openapi.json` sem header `Authorization`
- **THEN** o sistema retorna `200 OK` com Content-Type `application/json` e o documento OpenAPI 3.x completo

#### Scenario: Geração de tipos TypeScript em CI
- **WHEN** o pipeline de `bfin-web` executa `openapi-typescript http://api.bfincont.com.br/openapi.json`
- **THEN** o comando obtém a spec e gera o arquivo de tipos sem necessidade de credenciais

### Requirement: Swagger UI em /docs
O sistema SHALL servir Swagger UI interativa em `GET /docs` usando `@fastify/swagger-ui`. Em produção (`NODE_ENV === 'production'`), o endpoint SHALL exigir autenticação via Bearer Token de usuário admin.

#### Scenario: Acesso /docs em desenvolvimento
- **WHEN** um navegador acessa `GET /docs` com `NODE_ENV !== 'production'`
- **THEN** o sistema retorna a UI Swagger HTML sem exigir auth

#### Scenario: Acesso /docs em produção sem token
- **WHEN** um navegador acessa `GET /docs` em produção sem `Authorization`
- **THEN** o sistema retorna `401 Unauthorized`

#### Scenario: Acesso /docs em produção com token admin
- **WHEN** um request chega em `/docs` em produção com Bearer Token de usuário com `is_admin = true`
- **THEN** o sistema retorna a UI Swagger HTML

### Requirement: Spec inclui esquemas de erro padronizados
A spec OpenAPI SHALL documentar o shape de erro padrão da API (`{ code: string, message: string, details?: object }`) como componente reutilizável e referenciá-lo em todas as rotas que podem retornar `4xx`/`5xx`.

#### Scenario: Componente de erro presente
- **WHEN** um consumidor inspeciona `components.schemas` em `/openapi.json`
- **THEN** existe um schema nomeado (ex: `ApiError`) com `code` e `message` obrigatórios

#### Scenario: Rota com erro tipado
- **WHEN** uma rota documentada pode retornar `401`
- **THEN** a entrada `responses["401"]` referencia `$ref: "#/components/schemas/ApiError"`

## ADDED Requirements

### Requirement: Interceptação global de rotas protegidas
O sistema SHALL registrar um hook `onRequest` global no Fastify que intercepta todas as rotas. Rotas marcadas como públicas (ex: `/health`) SHALL ser excluídas da interceptação.

#### Scenario: Request a rota protegida sem token
- **WHEN** um request chega a uma rota protegida sem header `Authorization`
- **THEN** o sistema retorna `401 Unauthorized` com `code: "AUTH_REQUIRED"`

#### Scenario: Request a rota protegida com token válido
- **WHEN** um request chega a uma rota protegida com Bearer Token válido
- **THEN** o sistema valida o token, injeta dados do usuário em `request.user` e permite a continuação do request

#### Scenario: Request a rota pública sem token
- **WHEN** um request chega à rota `/health` sem header `Authorization`
- **THEN** o sistema permite a continuação do request normalmente, sem validação de token

### Requirement: Decorator request.user
O sistema SHALL decorar o objeto request do Fastify com a propriedade `user` contendo os dados do usuário autenticado: `id` (UUID do banco), `idProvedor` (sub do token), `nome`, `email` e `isAdmin`.

#### Scenario: Acesso a request.user em rota protegida
- **WHEN** uma rota protegida acessa `request.user` após autenticação bem-sucedida
- **THEN** o objeto contém `id`, `idProvedor`, `nome`, `email` e `isAdmin` do usuário autenticado

### Requirement: Formato do header Authorization
O sistema SHALL aceitar exclusivamente tokens no formato `Bearer <token>` no header `Authorization`. Outros formatos SHALL ser rejeitados.

#### Scenario: Header Authorization com formato incorreto
- **WHEN** um request chega com header `Authorization: Basic abc123`
- **THEN** o sistema retorna `401 Unauthorized` com `code: "AUTH_REQUIRED"`

#### Scenario: Header Authorization com Bearer mas token vazio
- **WHEN** um request chega com header `Authorization: Bearer `
- **THEN** o sistema retorna `401 Unauthorized` com `code: "AUTH_REQUIRED"`

### Requirement: Rota GET /me
O sistema SHALL expor uma rota `GET /me` que retorna os dados do usuário autenticado extraídos de `request.user`.

#### Scenario: Consulta do perfil autenticado
- **WHEN** um usuário autenticado faz `GET /me`
- **THEN** o sistema retorna `200 OK` com payload `{ id, nome, email, isAdmin }`

#### Scenario: Consulta sem autenticação
- **WHEN** um request não autenticado faz `GET /me`
- **THEN** o sistema retorna `401 Unauthorized` (interceptado pelo auth guard antes de chegar à rota)

## ADDED Requirements

### Requirement: Middleware de autorização por conta
O sistema SHALL fornecer um middleware Fastify reutilizável que verifica o papel do usuário autenticado em uma conta antes de permitir a operação. O middleware MUST extrair `contaId` do path param ou do request body, consultar `conta_usuarios` e comparar o papel do usuário com o papel mínimo exigido pela rota.

#### Scenario: Usuário com papel suficiente
- **WHEN** uma rota exige papel `owner` e o usuário autenticado possui `papel = 'owner'` na conta
- **THEN** o middleware permite a execução do handler

#### Scenario: Usuário com papel insuficiente
- **WHEN** uma rota exige papel `owner` e o usuário autenticado possui `papel = 'viewer'` na conta
- **THEN** o middleware retorna `403 Forbidden` com código `INSUFFICIENT_PERMISSIONS`

#### Scenario: Usuário sem associação com a conta
- **WHEN** o usuário autenticado não possui registro em `conta_usuarios` para a conta solicitada
- **THEN** o middleware retorna `403 Forbidden`

#### Scenario: Conta inexistente
- **WHEN** o `contaId` informado não existe na tabela `contas`
- **THEN** o middleware retorna `404 Not Found` com código `RESOURCE_NOT_FOUND`

### Requirement: Guard de admin para categorias
O sistema SHALL fornecer um guard (preHandler) que verifica se o usuário autenticado possui `is_admin = true`. Rotas de escrita de categorias (POST, PUT, DELETE) MUST usar este guard.

#### Scenario: Admin acessa rota protegida
- **WHEN** um usuário com `is_admin = true` acessa uma rota de escrita de categorias
- **THEN** o guard permite a execução do handler

#### Scenario: Não-admin tenta acessar rota protegida
- **WHEN** um usuário com `is_admin = false` acessa uma rota de escrita de categorias
- **THEN** o guard retorna `403 Forbidden` com código `INSUFFICIENT_PERMISSIONS`

### Requirement: Hierarquia de papéis
O sistema SHALL tratar `owner` como papel superior a `viewer`. Quando uma rota exige `viewer`, tanto `viewer` quanto `owner` MUST ser aceitos. Quando exige `owner`, apenas `owner` é aceito.

#### Scenario: Owner acessa rota que exige viewer
- **WHEN** uma rota exige papel mínimo `viewer` e o usuário é `owner`
- **THEN** o middleware permite a execução

#### Scenario: Viewer acessa rota que exige viewer
- **WHEN** uma rota exige papel mínimo `viewer` e o usuário é `viewer`
- **THEN** o middleware permite a execução

#### Scenario: Viewer tenta acessar rota que exige owner
- **WHEN** uma rota exige papel mínimo `owner` e o usuário é `viewer`
- **THEN** o middleware retorna `403 Forbidden`

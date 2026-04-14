## ADDED Requirements

### Requirement: Criar conta financeira
Um usuário autenticado SHALL poder criar uma conta via `POST /contas` com `nome` (obrigatório) e `saldo_inicial` (opcional, default 0.00, >= 0). O criador MUST ser automaticamente associado como `owner` na tabela `conta_usuarios`. A resposta retorna `201` com `id`, `nome`, `saldo_inicial`, `papel` ("owner") e `created_at`.

#### Scenario: Criar conta com saldo inicial
- **WHEN** um usuário autenticado envia `POST /contas` com `{"nome": "Conta Casa", "saldo_inicial": 5000.00}`
- **THEN** o sistema retorna `201 Created` com a conta criada e `papel: "owner"`
- **THEN** existe um registro em `conta_usuarios` com `papel = 'owner'` para esse usuário e conta

#### Scenario: Criar conta sem saldo inicial
- **WHEN** um usuário envia `POST /contas` com `{"nome": "Conta Pessoal"}`
- **THEN** o sistema retorna `201 Created` com `saldo_inicial: 0.00`

### Requirement: Listar contas do usuário
Um usuário autenticado SHALL poder listar suas contas via `GET /contas` com filtros `page` (default 1), `limit` (default 10) e `busca` (opcional, por nome). A listagem MUST retornar apenas contas às quais o usuário está associado (via `conta_usuarios`), incluindo o `papel` do usuário em cada conta.

#### Scenario: Listagem de contas do usuário
- **WHEN** um usuário autenticado envia `GET /contas`
- **THEN** o sistema retorna `200 OK` com as contas vinculadas ao usuário, incluindo `papel` em cada uma

#### Scenario: Usuário sem contas
- **WHEN** um usuário sem associações envia `GET /contas`
- **THEN** o sistema retorna `200 OK` com `data: []`

#### Scenario: Busca por nome de conta
- **WHEN** um usuário envia `GET /contas?busca=Casa`
- **THEN** o sistema retorna apenas contas cujo nome contém "Casa"

### Requirement: Atualizar conta
Um usuário com papel `owner` SHALL poder atualizar uma conta via `PATCH /contas/{contaId}` com `nome` (opcional) e `saldo_inicial` (opcional, >= 0).

#### Scenario: Owner atualiza conta com sucesso
- **WHEN** um owner envia `PATCH /contas/{contaId}` com `{"nome": "Novo Nome"}`
- **THEN** o sistema retorna `200 OK` com a conta atualizada

#### Scenario: Viewer tenta atualizar conta
- **WHEN** um viewer envia `PATCH /contas/{contaId}`
- **THEN** o sistema retorna `403 Forbidden`

#### Scenario: Conta não encontrada
- **WHEN** um usuário envia `PATCH /contas/{contaId}` com ID inexistente
- **THEN** o sistema retorna `404 Not Found`

### Requirement: Associar membro a conta
Um owner SHALL poder associar um novo membro via `POST /contas/{contaId}/usuarios` com `email` (obrigatório) e `papel` (`owner` ou `viewer`). O sistema MUST buscar o usuário pelo email e criar a associação em `conta_usuarios`.

#### Scenario: Owner associa membro com sucesso
- **WHEN** um owner envia `POST /contas/{contaId}/usuarios` com `{"email": "fulano@email.com", "papel": "viewer"}`
- **THEN** o sistema retorna `201 Created` e o usuário é associado à conta com o papel informado

#### Scenario: Viewer tenta associar membro
- **WHEN** um viewer envia `POST /contas/{contaId}/usuarios`
- **THEN** o sistema retorna `403 Forbidden`

#### Scenario: Usuário não encontrado pelo email
- **WHEN** um owner envia `POST /contas/{contaId}/usuarios` com um email que não existe no sistema
- **THEN** o sistema retorna `404 Not Found`

#### Scenario: Usuário já associado à conta
- **WHEN** um owner tenta associar um usuário que já está vinculado à conta
- **THEN** o sistema retorna `422 Unprocessable Entity` (constraint UNIQUE viola)

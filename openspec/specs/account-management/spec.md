# account-management Specification

## Purpose

Define a capability de contas financeiras: criação, listagem, atualização e associação de membros. Cada conta possui um conjunto de usuários vinculados via `conta_usuarios` com papel `owner` ou `viewer`. O criador de uma conta é automaticamente associado como `owner`. A atualização de `saldo_inicial` invalida projeções persistidas e emite evento de recálculo.

## Requirements

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
Um usuário com papel `owner` SHALL poder atualizar uma conta via `PATCH /contas/{contaId}` com `nome` (opcional) e `saldo_inicial` (opcional, >= 0). Quando a mutação altera `saldo_inicial`, o sistema MUST (1) invalidar, de forma síncrona antes de responder, todas as projeções persistidas da conta executando `UPDATE projecao SET status = 'invalidada' WHERE conta_id = {contaId}`; (2) tratar o erro PostgreSQL `42P01` como no-op quando a tabela ainda não existir; (3) após a resposta HTTP de sucesso, emitir o evento `projecao:recalcular` via `eventBus` com payload `{ contaId, mesInicial }`, onde `mesInicial` é o menor `mes` persistido em `projecao` para a conta ou, se a conta não possui nenhuma projeção persistida, o mês corrente em formato `YYYY-MM`. Alterações que não modificam `saldo_inicial` (ex.: apenas `nome`) MUST NOT invalidar projeções nem emitir eventos.

#### Scenario: Owner atualiza conta com sucesso
- **WHEN** um owner envia `PATCH /contas/{contaId}` com `{"nome": "Novo Nome"}`
- **THEN** o sistema retorna `200 OK` com a conta atualizada

#### Scenario: Viewer tenta atualizar conta
- **WHEN** um viewer envia `PATCH /contas/{contaId}`
- **THEN** o sistema retorna `403 Forbidden`

#### Scenario: Conta não encontrada
- **WHEN** um usuário envia `PATCH /contas/{contaId}` com ID inexistente
- **THEN** o sistema retorna `404 Not Found`

#### Scenario: Atualização de saldo_inicial invalida todas as projeções
- **WHEN** um owner envia `PATCH /contas/{contaId}` com `{"saldo_inicial": 7500.00}` e a conta possui projeções persistidas nos meses `2024-01`, `2024-02` e `2024-03`
- **THEN** o sistema executa, antes de responder `200`, `UPDATE projecao SET status = 'invalidada' WHERE conta_id = {contaId}` marcando as três linhas como `invalidada`

#### Scenario: Atualização de saldo_inicial emite projecao:recalcular
- **WHEN** um owner atualiza `saldo_inicial` e a conta possui projeções persistidas
- **THEN** o sistema emite, após a resposta `200`, `projecao:recalcular` com `{ contaId, mesInicial: menor_mes_persistido }`

#### Scenario: Atualização de saldo_inicial sem projeções emite evento com mês corrente
- **WHEN** um owner atualiza `saldo_inicial` em uma conta que ainda não possui projeções persistidas
- **THEN** o sistema emite `projecao:recalcular` com `mesInicial` igual ao mês corrente (`YYYY-MM`)

#### Scenario: Atualização apenas do nome não invalida projeções
- **WHEN** um owner envia `PATCH /contas/{contaId}` com `{"nome": "Novo Nome"}` (sem alterar `saldo_inicial`)
- **THEN** o sistema NÃO executa UPDATE em `projecao` e NÃO emite `projecao:recalcular`

#### Scenario: Tabela projecao ainda não existe
- **WHEN** um owner altera `saldo_inicial` antes da Etapa 6 ter criado a tabela `projecao`
- **THEN** o sistema trata o erro `42P01` como no-op, conclui a mutação com `200 OK` e ainda emite o evento `projecao:recalcular` (o listener decidirá)

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

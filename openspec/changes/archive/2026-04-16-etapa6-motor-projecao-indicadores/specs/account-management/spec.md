## MODIFIED Requirements

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

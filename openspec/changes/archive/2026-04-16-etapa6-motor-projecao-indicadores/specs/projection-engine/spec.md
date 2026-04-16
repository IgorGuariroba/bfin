## ADDED Requirements

### Requirement: Tabela de projeções persistidas

O sistema SHALL manter a tabela `projecao` com colunas `id` (UUID PK), `conta_id` (UUID FK → `conta`), `mes` (VARCHAR no formato `YYYY-MM`), `dados` (JSONB contendo o array diário e o resumo mensal), `status` (enum `atualizada` | `invalidada`, default `atualizada`), `recalculado_em` (TIMESTAMP NOT NULL), `created_at` e `updated_at`. A tabela MUST possuir índice único `(conta_id, mes)`. A criação MUST ocorrer via migration Drizzle e substituir o comportamento no-op das etapas 4 e 5.

#### Scenario: Migration criando a tabela
- **WHEN** a migration da Etapa 6 é aplicada
- **THEN** a tabela `projecao` existe no schema, o índice único `(conta_id, mes)` está presente, e o enum `status` contém apenas `atualizada` e `invalidada`

#### Scenario: Unicidade por (conta_id, mes)
- **WHEN** o sistema tenta inserir duas projeções com o mesmo `(conta_id, mes)`
- **THEN** o PostgreSQL rejeita com violação de unique constraint e o motor trata como UPSERT via `ON CONFLICT (conta_id, mes) DO UPDATE`

### Requirement: Endpoint GET /projecao

O sistema SHALL expor `GET /projecao?contaId={UUID}&mes={YYYY-MM}`, protegido por `Auth Guard` e pelo middleware de autorização por conta. `owner` e `viewer` MUST conseguir ler a projeção. Usuários sem vínculo com a conta MUST receber `403 Forbidden`. Parâmetros ausentes ou mal formados MUST retornar `422 BUSINESS_RULE_VIOLATION`.

#### Scenario: Owner solicita projeção válida
- **WHEN** um `owner` envia `GET /projecao?contaId={uuid}&mes=2024-03` para uma conta com meta definida
- **THEN** o sistema retorna `200 OK` com `contaId`, `mes`, `status`, `recalculado_em`, `meta_reserva`, array `projecao` com uma entrada por dia do mês, e objeto `resumo`

#### Scenario: Viewer solicita projeção válida
- **WHEN** um `viewer` envia `GET /projecao?contaId={uuid}&mes=2024-03`
- **THEN** o sistema retorna `200 OK` com o mesmo payload que seria retornado ao `owner`

#### Scenario: Usuário sem vínculo
- **WHEN** um usuário autenticado que não é membro da conta envia `GET /projecao?contaId={uuid}&mes=2024-03`
- **THEN** o sistema retorna `403 Forbidden` com `code: "INSUFFICIENT_PERMISSIONS"`

#### Scenario: Mês em formato inválido
- **WHEN** um `owner` envia `GET /projecao?contaId={uuid}&mes=03-2024`
- **THEN** o sistema retorna `422 BUSINESS_RULE_VIOLATION` sem executar cálculo

### Requirement: Cálculo diário de saldo, passivo e saldo líquido

Para cada dia `d` do mês solicitado, o motor MUST calcular:
- `saldo_projetado[d] = saldo_projetado[d-1] + receitas[d] - despesas[d] - parcelas_pagas[d]`;
- `total_dividas_pendentes[d]` = soma dos `valor` de todas as parcelas com `data_vencimento <= d` AND `data_pagamento IS NULL` para a conta;
- `saldo_liquido[d] = saldo_projetado[d] - total_dividas_pendentes[d]`.

O `saldo_projetado[0]` do primeiro dia do mês MUST ser o saldo final do mês anterior (via cascata) ou, quando não houver mês anterior, o `saldo_inicial` da conta. Movimentações recorrentes MUST ser replicadas no mês respeitando `data_fim` (exclusão de meses posteriores a `data_fim`). Parcelas com `data_vencimento > d` MUST ser invisíveis no dia `d`.

#### Scenario: Composição do saldo diário
- **WHEN** o motor calcula o dia 05 de um mês com `saldo_projetado[04]=3000`, `receitas[05]=500`, `despesas[05]=200`, `parcelas_pagas[05]=0`
- **THEN** `saldo_projetado[05] = 3300`

#### Scenario: Parcela futura não impacta dia anterior ao vencimento
- **WHEN** existe parcela com `data_vencimento=2024-03-15` e `data_pagamento IS NULL` e o motor calcula o dia `2024-03-10`
- **THEN** `total_dividas_pendentes[2024-03-10]` não inclui essa parcela e `saldo_liquido[2024-03-10] = saldo_projetado[2024-03-10]`

#### Scenario: Parcela vencida e não paga acumula
- **WHEN** existem duas parcelas com `data_vencimento=2024-03-01` e `data_vencimento=2024-03-15`, ambas com `data_pagamento IS NULL`, e o motor calcula o dia `2024-03-20`
- **THEN** `total_dividas_pendentes[2024-03-20]` inclui os valores de ambas as parcelas

#### Scenario: Recorrente com data_fim é replicada até o mês-limite
- **WHEN** uma movimentação recorrente tem `data_fim=2024-06-30` e o motor calcula o mês `2024-07`
- **THEN** essa movimentação não aparece em nenhum dia de `2024-07`

#### Scenario: Recorrente sem data_fim é replicada indefinidamente
- **WHEN** uma movimentação recorrente tem `data_fim IS NULL` e o motor calcula qualquer mês futuro
- **THEN** a movimentação é projetada no dia correspondente ao `data` original daquele mês

### Requirement: Resumo mensal da projeção

O motor MUST incluir em cada resposta um objeto `resumo` contendo `total_receitas`, `total_despesas`, `total_parcelas_pagas`, `total_dividas_pendentes` (valor ao final do mês), `saldo_final_projetado` (igual a `saldo_projetado[último_dia]`), `saldo_liquido_final`, `reserva_ideal`, `reserva_atingida` e `indicador_reserva_final`. Quando a conta não possui meta, `reserva_ideal`, `reserva_atingida` e `indicador_reserva_final` MUST ser `null`.

#### Scenario: Resumo com meta definida e reserva atingida
- **WHEN** o mês fecha com `saldo_liquido_final >= reserva_ideal`
- **THEN** o resumo retorna `reserva_atingida=true` e `indicador_reserva_final="verde"`

#### Scenario: Resumo sem meta
- **WHEN** a conta não possui meta ativa
- **THEN** `meta_reserva`, `reserva_ideal`, `reserva_atingida` e `indicador_reserva_final` são `null` em todo o payload

### Requirement: Cache lazy com persistência

Ao receber `GET /projecao`, o motor MUST:
1. Ler a projeção persistida para `(contaId, mes)`;
2. Se existir com `status='atualizada'`, retornar os `dados` do cache sem recalcular;
3. Se existir com `status='invalidada'` ou não existir, recalcular o mês, executar UPSERT em `projecao` (`ON CONFLICT (conta_id, mes) DO UPDATE`) com `status='atualizada'`, `recalculado_em=NOW()` e retornar o resultado.

#### Scenario: Leitura via cache atualizado
- **WHEN** existe `projecao(contaId, '2024-03')` com `status='atualizada'` e nenhum evento invalidou-a
- **THEN** o motor retorna os `dados` persistidos sem executar cálculo e preserva o `recalculado_em` original

#### Scenario: Recálculo após invalidação
- **WHEN** existe `projecao(contaId, '2024-03')` com `status='invalidada'`
- **THEN** o motor recalcula o mês, executa UPSERT com `status='atualizada'` e retorna os dados recém-calculados com `recalculado_em` atualizado

#### Scenario: Primeiro acesso ao mês
- **WHEN** não existe registro em `projecao` para `(contaId, '2024-03')`
- **THEN** o motor calcula o mês do zero (respeitando a cascata), insere a linha com `status='atualizada'` e retorna os dados

### Requirement: Cascata lazy para dependências de meses anteriores

Quando o motor precisa recalcular um mês `M` e ele não é o primeiro mês da conta, MUST obter o `saldo_final_projetado` do mês `M-1` pela seguinte ordem:
1. Se existe `projecao(contaId, M-1)` com `status='atualizada'`, usar seu `saldo_final_projetado` do `resumo`;
2. Caso contrário, recalcular `M-1` recursivamente (que por sua vez pode cascatear para `M-2`, etc.);
3. Caso base: quando não há mês anterior relevante (i.e., `M-1` é anterior à criação da conta ou a nenhum mês persistido), usar `Conta.saldo_inicial` como `saldo_projetado[0]`.

A profundidade máxima de recálculo em cascata em uma única requisição MUST ser limitada a 12 meses. Se a cascata exceder esse limite, o motor MUST abortar com `422` e `code: "CASCADE_DEPTH_EXCEEDED"`, sugerindo ao usuário atualizar `saldo_inicial`.

#### Scenario: Cascata de dois níveis
- **WHEN** o usuário solicita `mes=2024-05` e não existem projeções persistidas para `2024-04` nem `2024-05`, mas `2024-03` está persistido como `atualizada`
- **THEN** o motor calcula `2024-04` usando o saldo final de `2024-03`, calcula `2024-05` usando o saldo final de `2024-04`, persiste ambos e responde

#### Scenario: Caso base usa saldo_inicial
- **WHEN** a conta foi criada em `2024-03` (sem nenhum mês persistido anterior) e o usuário solicita `mes=2024-03`
- **THEN** o motor usa `Conta.saldo_inicial` como `saldo_projetado[0]` do dia `2024-03-01`

#### Scenario: Limite de 12 meses atingido
- **WHEN** o usuário solicita um mês cuja cadeia de recálculo exigiria mais de 12 meses a processar
- **THEN** o motor retorna `422 CASCADE_DEPTH_EXCEEDED` com mensagem indicando que `saldo_inicial` da conta deve ser atualizado

### Requirement: Invalidação em cascata por mutação

Quando uma mutação emite ou o motor recebe uma invalidação para o mês `M` da conta `X`, o sistema MUST executar `UPDATE projecao SET status='invalidada' WHERE conta_id = X AND mes >= M` em uma única operação. Essa atualização MUST ocorrer de forma síncrona antes de responder ao cliente (garantia já exigida em `transaction-management`, `debt-management` e `installment-payment`). O motor MUST aceitar múltiplas invalidações concorrentes sem corromper dados, confiando no lock de linha do PostgreSQL.

#### Scenario: Invalidação em cascata de múltiplos meses
- **WHEN** uma movimentação em `2024-02` é criada e existem projeções persistidas para `2024-02`, `2024-03` e `2024-04`
- **THEN** um único UPDATE marca as três como `invalidada`

#### Scenario: Invalidação idempotente
- **WHEN** a mesma invalidação é executada duas vezes seguidas
- **THEN** o segundo UPDATE é no-op funcional (todos os registros já estão `invalidada`) e não gera erro

### Requirement: EventEmitter para recálculo assíncrono

O sistema SHALL expor um singleton `eventBus` (baseado em `EventEmitter` nativo do Node.js) que aceita o evento `projecao:recalcular` com payload `{ contaId: string, mesInicial: string }` onde `mesInicial` está no formato `YYYY-MM`. O motor MUST registrar um listener permanente nesse evento que executa o recálculo de forma assíncrona após a resposta HTTP. O listener MUST usar `setImmediate` ou `Promise.resolve().then(...)` para não bloquear a event loop. Erros do listener MUST ser capturados e logados via Pino sem derrubar o processo.

#### Scenario: Emissão após mutação
- **WHEN** um `POST /movimentacoes` completa com sucesso, após a invalidação síncrona
- **THEN** o sistema emite `projecao:recalcular` com `{ contaId, mesInicial }` e o listener do motor inicia o recálculo de forma assíncrona

#### Scenario: Listener não bloqueia resposta HTTP
- **WHEN** o evento é emitido
- **THEN** a resposta HTTP do request já foi enviada antes que o recálculo tenha terminado

#### Scenario: Erro no listener não derruba o processo
- **WHEN** o recálculo assíncrono lança exceção
- **THEN** o erro é capturado e registrado via logger com `level='error'`, e o processo continua rodando

### Requirement: Freshness indicado via status e recalculado_em

A resposta de `GET /projecao` MUST incluir `status` (`atualizada` ou `invalidada`) e `recalculado_em` no payload de nível superior. Se o motor calculou/recalculou o mês durante a própria requisição, `status` MUST ser `atualizada`. Se o motor retornou do cache existente, o `status` persistido MUST ser refletido.

#### Scenario: Status refletido no cache
- **WHEN** `projecao(contaId, '2024-03')` possui `status='atualizada'` e é servida do cache
- **THEN** a resposta retorna `status="atualizada"` e `recalculado_em` igual ao valor persistido

#### Scenario: Cálculo em linha atualiza status
- **WHEN** o motor recalcula o mês durante a requisição
- **THEN** a resposta retorna `status="atualizada"` e `recalculado_em` equivalente ao momento do recálculo

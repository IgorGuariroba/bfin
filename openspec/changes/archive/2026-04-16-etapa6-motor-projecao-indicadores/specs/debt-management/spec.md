## MODIFIED Requirements

### Requirement: Invalidação de projeção após mutação de dívida
O sistema SHALL marcar projeções persistidas como `invalidada` de forma síncrona (antes de responder ao cliente) após criação ou deleção de dívida. O UPDATE MUST afetar o mês derivado de `data_inicio` (formato `YYYY-MM`) e todos os meses posteriores já persistidos da mesma conta. Se a tabela `projecao` não existir ainda, o sistema MUST tratar o erro PostgreSQL `42P01` como no-op e concluir a mutação com sucesso. Após a invalidação síncrona e o retorno da resposta HTTP de sucesso, o sistema MUST emitir `projecao:recalcular` via `eventBus` com payload `{ contaId, mesInicial }`, onde `mesInicial` é o mês de `data_inicio` em formato `YYYY-MM`.

#### Scenario: Invalidação após POST /dividas
- **WHEN** uma dívida é criada com `data_inicio: "2024-02-15"`
- **THEN** o sistema executa, antes de responder `201`, um UPDATE equivalente a `UPDATE projecao SET status = 'invalidada' WHERE conta_id = {contaId} AND mes >= '2024-02'`

#### Scenario: Invalidação após DELETE /dividas
- **WHEN** uma dívida com `data_inicio: "2024-02-15"` é deletada com sucesso
- **THEN** o sistema invalida projeções a partir de `2024-02` antes de responder `200`

#### Scenario: Tabela projecao ainda não existe
- **WHEN** uma dívida é criada antes da Etapa 6 ter criado a tabela `projecao`
- **THEN** o sistema conclui a criação normalmente retornando `201 Created` (erro `42P01` é engolido)

#### Scenario: Emissão de projecao:recalcular após criar dívida
- **WHEN** uma dívida é criada com `data_inicio: "2024-02-15"` na conta `X`
- **THEN** o sistema emite `projecao:recalcular` com payload `{ contaId: X, mesInicial: "2024-02" }` após a invalidação síncrona

#### Scenario: Emissão de projecao:recalcular após deletar dívida
- **WHEN** uma dívida com `data_inicio: "2024-02-15"` é deletada com sucesso
- **THEN** o sistema emite `projecao:recalcular` com `mesInicial: "2024-02"`

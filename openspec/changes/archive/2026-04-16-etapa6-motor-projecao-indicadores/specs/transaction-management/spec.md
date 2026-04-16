## MODIFIED Requirements

### Requirement: Invalidação de projeção após mutação
O sistema SHALL marcar projeções persistidas como `invalidada` (valor do campo `status` na tabela `projecao`) após criação, atualização ou exclusão de movimentações, de forma síncrona, antes de responder ao cliente. Após concluir a invalidação síncrona e a resposta HTTP de sucesso, o sistema MUST emitir o evento `projecao:recalcular` via `eventBus` (singleton `EventEmitter`) com payload `{ contaId, mesInicial }` onde `mesInicial` é o menor mês afetado no formato `YYYY-MM`. A emissão do evento MUST ocorrer mesmo que a tabela `projecao` ainda não exista (o listener do motor decidirá se recalcula). A execução do listener (recálculo assíncrono) é responsabilidade do motor de projeção e não bloqueia a resposta HTTP.

#### Scenario: Projeção invalidada após criar movimentação
- **WHEN** uma movimentação é criada com sucesso na data `YYYY-MM-DD`
- **THEN** o sistema executa, antes de responder, um UPDATE equivalente a `UPDATE projecao SET status = 'invalidada' WHERE conta_id = {contaId} AND mes >= 'YYYY-MM'`, afetando o mês da movimentação e todos os meses posteriores já persistidos

#### Scenario: Projeção invalidada após atualizar data da movimentação
- **WHEN** uma movimentação tem sua `data` alterada de `2024-05-10` para `2024-03-15`
- **THEN** o sistema invalida projeções a partir do menor mês entre os dois (`2024-03`) em diante

#### Scenario: Invalidação quando a tabela projecao ainda não existe
- **WHEN** uma movimentação é criada antes da Etapa 6 ter criado a tabela `projecao`
- **THEN** o sistema trata o erro `42P01` (undefined_table) do PostgreSQL como no-op e conclui a mutação com sucesso (`201 Created`)

#### Scenario: Emissão de projecao:recalcular após criar movimentação
- **WHEN** uma movimentação é criada com sucesso na data `2024-03-15` para a conta `X`
- **THEN** o sistema emite, após a invalidação síncrona, o evento `projecao:recalcular` com payload `{ contaId: X, mesInicial: "2024-03" }`

#### Scenario: Emissão de projecao:recalcular após atualizar data
- **WHEN** uma movimentação tem sua `data` alterada de `2024-05-10` para `2024-03-15`
- **THEN** o sistema emite o evento `projecao:recalcular` com `mesInicial: "2024-03"` (menor dos dois meses)

#### Scenario: Emissão de projecao:recalcular após deletar movimentação
- **WHEN** uma movimentação com `data=2024-04-10` é deletada com sucesso
- **THEN** o sistema emite `projecao:recalcular` com `mesInicial: "2024-04"`

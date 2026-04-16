## ADDED Requirements

### Requirement: Tabela de meta de reserva

O sistema SHALL manter a tabela `meta` com colunas `id` (UUID PK), `conta_id` (UUID FK → `conta`, UNIQUE), `porcentagem_reserva` (DECIMAL(5,2) NOT NULL, entre 0.00 e 100.00 inclusive), `created_at` e `updated_at`. O vínculo `conta_id` MUST ser único, garantindo no máximo uma meta por conta (relação 1:1). A deleção da conta MUST propagar para a meta via `ON DELETE CASCADE`.

#### Scenario: Migration cria a tabela com unique
- **WHEN** a migration da Etapa 6 é aplicada
- **THEN** a tabela `meta` existe com `UNIQUE(conta_id)` e FK `conta_id → conta.id ON DELETE CASCADE`

### Requirement: Criar ou atualizar meta

O sistema SHALL expor `POST /metas` protegido por `Auth Guard` e pelo middleware de autorização por conta, aceitando body `{ contaId: UUID, porcentagem_reserva: number }`. O comportamento MUST ser UPSERT: se a conta já possui meta, a porcentagem é atualizada; caso contrário, a meta é criada. Apenas usuários com papel `owner` na conta MUST poder invocar a rota. `viewer` MUST receber `403 INSUFFICIENT_PERMISSIONS`. A resposta MUST ser `201 Created` quando cria e `200 OK` quando atualiza, em ambos os casos retornando `{ id, contaId, porcentagem_reserva, created_at, updated_at }`.

#### Scenario: Owner cria meta nova
- **WHEN** um `owner` envia `POST /metas` com `{ contaId, porcentagem_reserva: 25 }` para uma conta sem meta
- **THEN** o sistema retorna `201 Created` com a meta persistida

#### Scenario: Owner atualiza meta existente
- **WHEN** um `owner` envia `POST /metas` com `{ contaId, porcentagem_reserva: 30 }` para uma conta que já possui meta
- **THEN** o sistema retorna `200 OK` com a meta atualizada e `updated_at` refletindo o momento da mutação

#### Scenario: Viewer tenta criar meta
- **WHEN** um `viewer` envia `POST /metas` para uma conta onde tem papel `viewer`
- **THEN** o sistema retorna `403 Forbidden` com `code: "INSUFFICIENT_PERMISSIONS"`

### Requirement: Validação de porcentagem

O sistema MUST validar `porcentagem_reserva` no intervalo fechado `[0, 100]`. Valores negativos, maiores que 100, não numéricos ou com mais de 2 casas decimais MUST retornar `422 BUSINESS_RULE_VIOLATION` com mensagem explicativa. Não há trava de viabilidade: qualquer valor no intervalo MUST ser aceito mesmo que seja incompatível com o padrão de gastos da conta.

#### Scenario: Percentual fora do intervalo
- **WHEN** um `owner` envia `POST /metas` com `porcentagem_reserva: 150`
- **THEN** o sistema retorna `422 BUSINESS_RULE_VIOLATION`

#### Scenario: Percentual negativo
- **WHEN** um `owner` envia `POST /metas` com `porcentagem_reserva: -5`
- **THEN** o sistema retorna `422 BUSINESS_RULE_VIOLATION`

#### Scenario: Percentual no limite
- **WHEN** um `owner` envia `POST /metas` com `porcentagem_reserva: 0` ou `porcentagem_reserva: 100`
- **THEN** o sistema aceita e persiste o valor

### Requirement: Invalidação e recálculo após alteração de meta

Após criar ou atualizar a meta, o sistema MUST (1) invalidar projeções da conta para todos os meses persistidos e (2) emitir `projecao:recalcular` com `{ contaId, mesInicial }` onde `mesInicial` é o menor `mes` persistido em `projecao` para a conta (ou o mês corrente, se a conta não possui projeções persistidas). A invalidação MUST ocorrer de forma síncrona antes da resposta HTTP.

#### Scenario: Emissão do evento de recálculo
- **WHEN** um `owner` cria ou atualiza uma meta via `POST /metas`
- **THEN** o sistema invalida todas as projeções persistidas da conta e emite `projecao:recalcular` antes de responder

#### Scenario: Conta sem projeções persistidas
- **WHEN** um `owner` define meta em uma conta que ainda não possui nenhuma projeção persistida
- **THEN** a resposta HTTP é enviada normalmente e o evento usa o mês corrente como `mesInicial`

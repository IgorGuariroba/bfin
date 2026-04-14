## Context

A Etapa 3 entregou Categorias e Contas com RBAC contextual (owner/viewer) e middleware de autorização reutilizável. Agora é possível criar a entidade central do sistema: Movimentações. O plano (seção 5.4) define CRUD completo com validação cruzada tipo × categoria, recorrência com data limite opcional, e listagem paginada com filtros. Toda mutação deve emitir evento `projecao:invalidada` para o motor de projeção (etapa futura).

## Goals / Non-Goals

**Goals:**

- Implementar schema Drizzle para tabela `movimentacoes` conforme modelo de dados do plano
- Implementar CRUD completo: POST, PUT, DELETE, GET com paginação e filtros
- Validação cruzada tipo × categoria (o tipo da movimentação deve corresponder ao tipo da categoria)
- Lógica de recorrência: `recorrente` + `data_fim` com regras de cancelamento
- Proteção contra deleção de movimentações geradas pelo sistema (campo `system_generated`)
- Emissão de evento `projecao:invalidada` em toda mutação
- Reutilizar middleware de autorização por conta da Etapa 3

**Non-Goals:**

- Motor de projeção e recálculo (Etapa futura)
- Dívidas e parcelas (Etapa 5)
- Consumo do evento `projecao:invalidada` — apenas emissão
- Dashboard ou agregações de movimentações

## Decisions

### 1. Campo `tipo` na tabela movimentacoes vs. derivar da categoria

**Decisao**: Não armazenar `tipo` na tabela `movimentacoes`. O tipo é derivado da categoria referenciada.

**Alternativa**: Coluna `tipo` ENUM na tabela com validação de consistência.

**Razao**: O modelo de dados do plano não inclui `tipo` como campo da entidade Movimentacao — o tipo é inferido via `categoria_id → categoria.tipo`. Isso evita redundância e impossibilidade de inconsistência. Na API, `tipo` é aceito no body do POST/PUT apenas para validação: verifica-se que corresponde ao tipo da categoria.

### 2. Identificação de movimentações geradas pelo sistema

**Decisao**: Adicionar campo booleano `system_generated` (default false) na tabela. Movimentações criadas automaticamente por pagamento de parcela (etapa futura) terão `system_generated = true`.

**Alternativa**: Verificar via join com tabela de parcelas.

**Razao**: O plano exige que movimentações geradas pelo sistema não possam ser deletadas (retorna 422 `SYSTEM_GENERATED_RESOURCE`). Um campo booleano é mais performático que um join e desacopla a verificação da existência da tabela de parcelas (que será criada em etapa posterior).

### 3. Filtro por período — reuso do nome `data_fim` como query param

**Decisao**: Na rota GET, o query param de filtro de data final se chama `data_fim` (conforme plano seção 5.4). Isso é diferente do campo `data_fim` da entidade (data limite de recorrência). O contexto de uso (query param vs. campo da entidade) evita ambiguidade.

**Razao**: Seguir exatamente o contrato da API definido no plano.

### 4. Emissão de eventos via EventEmitter do Fastify

**Decisao**: Usar o EventEmitter nativo do Node.js, registrado como decorator do Fastify. As rotas de mutação emitem `projecao:invalidada` com payload `{ contaId, mesInicial }`.

**Alternativa**: Sistema de filas externo (Redis, RabbitMQ).

**Razao**: O plano define arquitetura com EventEmitter interno. O consumidor será implementado em etapa futura. Por ora, o evento é emitido mas não consumido — o handler será um no-op ou log.

### 5. Paginação e filtros no GET

**Decisao**: Seguir padrão do plano: query params `page`, `limit`, `contaId` (obrigatório), `busca`, `data_inicio`, `data_fim`, `tipo`, `categoriaId`. Resposta com objeto `pagination` contendo `page`, `limit`, `total`, `totalPages`.

**Razao**: Contrato definido na seção 5.4 do plano, consistente com padrão de paginação já usado em Categorias e Contas.

### 6. Partial update no PUT

**Decisao**: PUT aceita todos os campos como opcionais (partial update). Apenas os campos enviados são atualizados.

**Razao**: Definido explicitamente no plano: "mesmos campos do POST, todos opcionais (partial update)". Permite cancelamento de recorrência enviando apenas `{ recorrente: false }`.

## Risks / Trade-offs

- **[Tipo derivado da categoria]** → Queries de listagem precisam join com categorias para exibir o tipo. Mitigacao: o join já é necessário para retornar `categoria.nome` na resposta, então não há custo adicional.

- **[Evento sem consumidor]** → Emitir `projecao:invalidada` sem consumidor pode causar confusão em debugging. Mitigacao: registrar um listener que faz log do evento até que o motor de projeção seja implementado.

- **[Campo `system_generated` prematuro]** → A tabela de parcelas ainda não existe, então nenhuma movimentação será system_generated nesta etapa. Mitigacao: o campo existe com default false e a validação de DELETE já estará pronta quando parcelas forem implementadas.

- **[Race condition em updates concorrentes]** → Dois owners podem atualizar a mesma movimentação simultaneamente. Mitigacao: `updated_at` é atualizado atomicamente; conflitos de última escrita são aceitáveis neste domínio (não há saldo afetado diretamente pela movimentação).

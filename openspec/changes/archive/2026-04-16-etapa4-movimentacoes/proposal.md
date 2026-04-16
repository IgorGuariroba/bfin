## Why

As etapas anteriores entregaram autenticação, usuários, categorias e contas financeiras. Agora é possível saber **quem** opera e **sobre o quê**, mas ainda não há como registrar o fluxo financeiro real — receitas e despesas. Movimentações são a entidade central do sistema: sem elas, não há saldo, projeção nem indicadores. Esta etapa habilita o registro, consulta e gestão de transações financeiras, incluindo recorrência.

## What Changes

- CRUD completo de Movimentações (`POST`, `PUT`, `DELETE`, `GET /movimentacoes`) conforme seção 5.4 do plano
- Validação cruzada tipo × categoria (o `tipo` da movimentação deve corresponder ao `tipo` da categoria referenciada)
- Lógica de recorrência: campo `recorrente` com suporte a `data_fim` opcional, cancelamento via `PUT` com `recorrente: false` (limpa `data_fim` automaticamente)
- Proteção contra deleção de movimentações geradas pelo sistema (pagamento de parcela de dívida) — retorna `422 SYSTEM_GENERATED_RESOURCE`
- Listagem paginada com filtros: `contaId`, `tipo`, `categoriaId`, `busca` (descrição), `data_inicio`, `data_fim`
- Emissão de evento `projecao:invalidada` em toda mutação (CREATE, UPDATE, DELETE) para futuro recálculo de projeção
- Schema Drizzle para tabela `movimentacoes`
- Migration para criar a tabela no PostgreSQL

## Capabilities

### New Capabilities

- `transaction-management`: CRUD de Movimentações (receitas/despesas) com validação de tipo vs. categoria, controle de acesso owner/viewer, paginação e filtros
- `transaction-recurrence`: Lógica de recorrência de movimentações — replicação indefinida ou com data limite, cancelamento preservando histórico

### Modified Capabilities

(nenhuma — não há specs existentes para modificar)

## Impact

- **Código**: Novo schema Drizzle em `src/db/schema/`, service em `src/services/`, routes em `src/routes/`, validações Zod para request/response
- **API**: 4 novas rotas (`POST`, `PUT`, `DELETE`, `GET`) sob `/movimentacoes`
- **Eventos**: Emissão de `projecao:invalidada` (consumidor será implementado em etapa futura)
- **Dependências**: Depende das tabelas `contas`, `categorias`, `usuarios` e `conta_usuarios` (etapas anteriores)

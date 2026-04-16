## Why

O sistema precisa permitir que os usuários registrem e gerenciem receitas e despesas vinculadas às suas contas financeiras. As movimentações são o núcleo operacional da API financeira — sem elas, não há dados para alimentar o motor de projeção e os indicadores de saúde patrimonial. Esta etapa implementa o CRUD completo de movimentações, incluindo a lógica de recorrência essencial para projeções futuras.

## What Changes

- Criação da entidade `Movimentacao` no banco de dados com suporte a recorrência (`recorrente`, `data_fim`).
- Endpoints REST para CRUD de movimentações (`POST`, `GET`, `PUT`, `DELETE /movimentacoes`).
- Validação de integridade entre o tipo da movimentação (`receita` | `despesa`) e o tipo da categoria vinculada.
- Listagem paginada de movimentações com múltiplos filtros (data, tipo, categoria, busca por descrição).
- Lógica de recorrência para projeção: replicação indefinida ou até `data_fim`, com cancelamento explícito.
- Invalidação síncrona de projeções persistidas após mutações em movimentações (UPDATE marcando `status = 'invalidada'` no mês inicial e posteriores). A emissão do evento `projecao:recalcular` para o recálculo assíncrono é responsabilidade do motor de projeção (Etapa 6) — nesta etapa apenas o UPDATE síncrono é executado, como no-op seguro se a tabela `projecao` ainda não existir.

## Capabilities

### New Capabilities
- `transaction-management`: CRUD de movimentações financeiras (receitas/despesas), validação de categoria, filtros e paginação.
- `recurrence-logic`: Replicação de movimentações recorrentes na projeção com suporte a data limite (`data_fim`) e cancelamento.

### Modified Capabilities
- *(nenhuma — requisitos de specs existentes não são alterados)*

## Impact

- Novas rotas na API Fastify (`/movimentacoes`).
- Nova tabela `movimentacoes` no schema Drizzle/PostgreSQL.
- Invalidação síncrona de projeção via UPDATE em `projecao.status`. O `EventEmitter` e o listener de recálculo serão introduzidos na Etapa 6.
- O motor de projeção (Etapa 6) depende desta estrutura, mas a projeção em si não é implementada nesta etapa.

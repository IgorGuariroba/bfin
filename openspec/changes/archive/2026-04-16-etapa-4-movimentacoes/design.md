## Context

As etapas 1–3 já estão implementadas: infraestrutura Fastify + Drizzle + PostgreSQL, autenticação OIDC, CRUD de categorias (admin) e contas financeiras com RBAC contextual (`owner`/`viewer`). O próximo passo natural é habilitar o registro de movimentações (receitas e despesas), que são a entrada de dados para todo o restante do sistema (projeções, indicadores, dívidas).

## Goals / Non-Goals

**Goals:**
- Adicionar a entidade `Movimentacao` ao schema do banco com suporte a recorrência.
- Implementar endpoints REST para criação, edição, exclusão e listagem de movimentações.
- Validar consistência entre `tipo` da movimentação e `tipo` da categoria vinculada.
- Implementar lógica de recorrência (`recorrente`, `data_fim`, cancelamento) de forma que o motor de projeção (Etapa 6) possa consumi-la sem retrabalho.
- Emitir eventos de invalidação de projeção após mutações.
- Garantir que apenas `owner` possa criar/editar/excluir movimentações; `viewer` tem acesso somente leitura via listagem.

**Non-Goals:**
- Implementar o motor de projeção em si (Etapa 6).
- Implementar dívidas e parcelas (Etapa 5).
- Criar interface de usuário (frontend/mobile).

## Decisions

### 1. Estrutura da tabela `movimentacoes`
A tabela seguirá o modelo definido em `plano.md`:
- `id`, `conta_id`, `usuario_id`, `categoria_id`, `descricao`, `valor` (DECIMAL 12,2), `data` (DATE), `recorrente` (BOOLEAN), `data_fim` (DATE NULL), `created_at`, `updated_at`.
- `usuario_id` registra quem criou a movimentação para rastreabilidade.
- `valor` sempre será positivo no banco; o impacto (soma/subtração) é determinado pelo tipo da categoria no momento da projeção.

### 2. Validação tipo vs. categoria
A validação será feita no service layer:
- Buscar a categoria pelo `categoriaId`.
- Verificar se o `slug` do `TipoCategoria` associado corresponde ao `tipo` enviado no payload (`receita` ou `despesa`).
- Em caso de divergência, lançar `BusinessRuleError` (422) com código `BUSINESS_RULE_VIOLATION`.
- Categorias do tipo `divida` só poderão ser usadas em dívidas (Etapa 5), não em movimentações.

### 2.1 Detecção de "movimentação gerada pelo sistema"
A regra do plano §5.4 exige bloquear `DELETE /movimentacoes/{id}` quando a movimentação foi gerada automaticamente pelo pagamento de uma parcela. Nesta Etapa 4 ainda não existe a entidade `ParcelaDivida` nem vínculo explícito entre parcela e movimentação — isso é introduzido na Etapa 5.

Decisão para esta etapa:
- O schema da `Movimentacao` permanece idêntico ao plano §4 (sem coluna de vínculo).
- O service `deleteTransaction` já chama uma função `isSystemGenerated(movimentacaoId)` que nesta etapa retorna sempre `false` (no-op). Assim, a interface do serviço e os códigos de erro já ficam prontos.
- Na Etapa 5 essa função passará a consultar a nova tabela `parcela_divida` (ou coluna `parcela_id` adicionada à `movimentacao`, a decidir no design da Etapa 5) para devolver `true` quando a movimentação tiver sido gerada por pagamento de parcela.
- O spec de `transaction-management` mantém o cenário `SYSTEM_GENERATED_RESOURCE` porque é o comportamento observável final; a implementação do "como detectar" é finalizada na Etapa 5.

### 3. Lógica de recorrência
A recorrência será representada por um único registro na tabela:
- `recorrente = true` + `data_fim = null` → recorrência indefinida.
- `recorrente = true` + `data_fim = YYYY-MM-DD` → recorrência até aquele mês (inclusive).
- `recorrente = false` → ocorrência única; `data_fim` deve ser `null` (rejeitado se enviado).

O cancelamento de recorrência ocorre via `PUT` com `recorrente: false`. O campo `data_fim` é automaticamente limpo. Meses anteriores já projetados não são afetados — o histórico é preservado. O motor de projeção (Etapa 6) interpretará esse registro para replicar a movimentação nos meses aplicáveis.

### 4. Invalidação de projeção (alinhado ao plano §7 e §8)
Nomenclatura do plano, para evitar confusão:
- **`invalidada`** é um valor do campo `status` na tabela `projecao` (enum `atualizada | invalidada`).
- **`projecao:recalcular`** é o nome do evento do `EventEmitter` que dispara o recálculo assíncrono.

Nesta Etapa 4 implementamos **apenas a fase síncrona de invalidação**, sem EventEmitter:
- O route handler chama o service para mutar os dados.
- Após o sucesso da operação, antes de responder, o service executa um UPDATE síncrono no PostgreSQL equivalente a:
  ```sql
  UPDATE projecao
  SET status = 'invalidada'
  WHERE conta_id = $1
    AND mes >= $2;
  ```
  onde `$2` é `'YYYY-MM'` derivado da `data` da movimentação criada/alterada/removida. Em `UPDATE`, consideramos o menor `mes` entre o valor antigo e o novo.
- Se a tabela `projecao` ainda não existir (Etapa 6 ainda não implementada), o comando é um no-op seguro — encapsulado em `try/catch` que engole erros `undefined_table` (42P01) do PostgreSQL.
- O EventEmitter e o listener `projecao:recalcular` ficam integralmente para a Etapa 6. Não emitimos o evento aqui (nem via `process.nextTick`).

### 5. Filtros da listagem
A listagem `GET /movimentacoes` aceitará filtros combináveis:
- `contaId` (obrigatório, validado pelo middleware de autorização)
- `data_inicio`, `data_fim`
- `tipo` (`receita` | `despesa`)
- `categoriaId`
- `busca` (ilike na `descricao`)
- `page`, `limit`

A paginação seguirá o mesmo formato já usado em `/contas` e `/categorias`, alinhado ao plano §5.4:
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

## Risks / Trade-offs

- [Risk] A lógica de recorrência está sendo modelada agora, mas só será testada de ponta a ponta na Etapa 6. → Mitigação: documentar claramente as regras de recorrência nos specs e no design para garantir que o motor de projeção as consuma corretamente.
- [Risk] `data_fim` enviada sem `recorrente = true` pode causar confusão. → Mitigação: validação explícita que rejeita `data_fim` quando `recorrente = false`.
- [Risk] O UPDATE de invalidação pode falhar silenciosamente se a tabela `projecao` ainda não existir. → Mitigação: envolver o UPDATE em `try/catch` no service, ignorando apenas o erro `42P01` (undefined_table) do PostgreSQL e relançando qualquer outro.
- [Risk] Detecção de "movimentação gerada pelo sistema" fica como no-op nesta etapa (sempre `false`), logo testes de integração não conseguem exercitar o cenário `SYSTEM_GENERATED_RESOURCE` com dados reais. → Mitigação: manter o cenário no spec (comportamento observável permanece válido) e adicionar um teste unitário/integrado específico quando a Etapa 5 ligar o vínculo parcela↔movimentação.

## Context

A API bfin chegou ao fim da Etapa 5 com todo o CRUD transacional funcional: usuários (OIDC), contas compartilhadas, categorias, movimentações e dívidas com parcelas. Nenhuma inteligência financeira foi entregue ainda — as rotas atuais apenas persistem e leem dados. O `plano.md` (v2) descreve o motor de projeção como o coração do produto: é ele quem transforma linhas em insight financeiro dia-a-dia. As etapas 4 e 5 já plantaram ganchos de **invalidação síncrona no-op** (hoje `UPDATE ... WHERE status='invalidada'` falha com `42P01` e é engolido) e um placeholder em `src/services/projection-invalidation.ts` para que a Etapa 6 ative sem precisar modificar as rotas existentes.

Restrições conhecidas:

- **No Mocks**: testes de integração rodam contra PostgreSQL real via `docker-compose.test.yml`; nada pode depender de queries mockadas.
- **PM2 cluster mode**: em produção a API roda multi-processo; o EventEmitter é per-process e qualquer recálculo disparado por evento só roda no processo que recebeu a requisição.
- **Sem Redis/BullMQ no MVP**: o `plano.md` § 8 é explícito: `EventEmitter` in-process suficiente para o MVP, com migração futura "direta" para fila externa se necessário.
- **Freshness é do cliente**: o frontend tolera ler `status='invalidada'` por 1–2 s enquanto o recálculo assíncrono acontece.
- **Arredondamento bancário**: a aritmética monetária segue o padrão já usado pelas dívidas (`HALF_EVEN` com 2 casas) — nenhum `number` JS floating-point em operações de soma.

Stakeholders: o usuário final (que olha projeção + indicador + limite diário) e o dev que continuará a Etapa 7 (produção, MCP). Nenhuma integração externa.

## Goals / Non-Goals

**Goals:**

- Motor de projeção dia-a-dia que respeita a seção 7 do `plano.md` (cálculo, cascata lazy, cache, limite de 12 meses).
- Persistência correta da tabela `projecao` (uma linha por `(conta_id, mes)`) com `status` e `recalculado_em` consultáveis.
- `EventEmitter` singleton tipado, com um único listener do motor e logging estruturado de falhas.
- Indicador de Reserva verde/amarelo/vermelho/null, derivado sempre da mesma fórmula (seção 6.4 + 7).
- Rotas `GET /projecao`, `POST /metas`, `GET /contas/{contaId}/limite-diario` com o mesmo estilo das rotas já existentes (`zod` schemas, `Auth Guard`, middleware de autorização por conta, erros padronizados § 10).
- Invalidação em cascata idempotente e atômica (um único UPDATE por mutação), já emitida em sincronia pelas capabilities existentes.
- Suíte de testes de integração cobrindo: cálculo diário, cascata lazy, limite de 12 meses, cache hit, recálculo após evento, indicador em cada cor, limite diário com e sem recorrentes/parcelas.

**Non-Goals:**

- Escalabilidade multi-processo do EventEmitter (fica com trade-off documentado e idempotência do recálculo).
- Expiração/TTL de projeções antigas (pode virar backlog da Etapa 7 se necessário).
- Webhooks externos ou fila externa (explicitamente fora do MVP).
- Notificações push/e-mail quando o indicador ficar vermelho (frontend decide como apresentar).
- Endpoint `DELETE /metas` ou histórico de metas (o MVP usa UPSERT 1:1, sem versionamento).
- Ajustes no contrato de `GET /dividas`, `GET /movimentacoes` etc. — essas capabilities continuam intocadas pelo que já foi especificado.

## Decisions

### 1. Tabela `projecao` como JSONB + metadados

**Decisão**: manter `dados JSONB` (array de dias + resumo) + colunas de controle (`status`, `recalculado_em`, `mes`, `conta_id`).

**Alternativas consideradas**:
- **(A)** Normalizar em tabelas `projecao_dia` e `projecao_resumo` (uma linha por dia). *Contra*: 30× mais linhas, cada recálculo vira muitos INSERT/DELETE ou UPSERT, e nenhuma query analítica ganha valor óbvio para o MVP. *A favor*: consultas cirúrgicas por dia.
- **(B)** Serializar `dados` em TEXT. *Contra*: perde integridade tipada e qualquer `jsonb_path_query` futuro.

**Por quê JSONB**: o payload do `GET /projecao` é consumido em bloco. A recomputação é sempre do mês inteiro — não há leitura parcial que justifique normalização. `JSONB` preserva tipagem, permite indexação futura e mantém o schema simples.

### 2. Cascata lazy recursiva limitada a 12 meses

**Decisão**: quando o motor precisa do saldo final do mês `M-1`, tenta ler do cache; se não houver `status='atualizada'`, recalcula recursivamente. O contador de profundidade é passado por parâmetro e aborta com `422 CASCADE_DEPTH_EXCEEDED` após 12 recursões.

**Alternativas**:
- **(A)** Calcular eager todo o histórico da conta desde o primeiro mês em um grande loop. *Contra*: requisições na frente de contas antigas virariam catastróficas.
- **(B)** Background job periódico que mantém tudo atualizado. *Contra*: MVP explicitamente não quer jobs agendados; complica deploy.

**Justificativa**: 12 meses cobre o caso realista de reabrir um app antigo ou alterar `saldo_inicial`; acima disso a recomendação do `plano.md` é o usuário atualizar `saldo_inicial` (reset explícito). Transformar em erro claro é melhor que travar a API.

### 3. EventEmitter singleton vs. injeção de dependência

**Decisão**: exportar um módulo `src/lib/event-bus.ts` que cria um `EventEmitter` singleton com API tipada:

```ts
type ProjecaoRecalcularPayload = { contaId: string; mesInicial: string };
export const eventBus: {
  emit: (event: "projecao:recalcular", payload: ProjecaoRecalcularPayload) => void;
  on: (event: "projecao:recalcular", handler: (p: ProjecaoRecalcularPayload) => void | Promise<void>) => void;
};
```

**Alternativa**: passar o emitter como dependência via Fastify plugin e injetar nos serviços. *Contra*: adiciona ruído sem ganho testável (os testes preferem observar o efeito — o `status='atualizada'` — não a emissão).

**Por quê singleton**: fácil de importar, zero ceremônia, e idempotência do listener cobre o risco de múltiplos handlers. Em testes, o isolamento é feito por banco limpo entre suites, não por instâncias separadas do emitter.

### 4. Listener in-process com `setImmediate`

**Decisão**: registrar um único listener em `src/services/projection-engine/index.ts` durante o bootstrap do app, que agenda o recálculo via `setImmediate(() => recalcular(...))` e captura exceções com `.catch(err => logger.error(...))`.

**Por quê**: garantir que a resposta HTTP termine antes do recálculo começar, sem bloquear a event loop. Erros são isolados por request para evitar derrubar o processo.

### 5. Consistência em cluster mode via PostgreSQL

**Decisão**: aceitar que, em cluster mode, múltiplos processos podem invalidar e recalcular a mesma projeção. A correção vem de:
- **Invalidação síncrona no banco** (única fonte de verdade; todos os processos enxergam).
- **Recálculo idempotente** (duas execuções sobre o mesmo `(contaId, mes)` produzem o mesmo `dados` — UPSERT com `ON CONFLICT DO UPDATE` resolve).
- **Sem locks distribuídos**: no pior caso, dois processos recalculam; o último UPSERT vence. O frontend observa `recalculado_em` para saber se precisa re-fetchar.

**Alternativa**: `pg_advisory_lock` por `(conta_id, mes)`. *Contra*: complexidade extra para ganho marginal no MVP. Pode entrar na Etapa 7 se houver pressão.

### 6. `eventBus` emitido mesmo quando a tabela não existe

**Decisão**: o código que faz a invalidação síncrona (já existente em `src/services/projection-invalidation.ts`) passa a também emitir `projecao:recalcular` incondicionalmente. Na Etapa 6 a tabela passa a existir, então o listener efetivamente trabalha; em hipotético rollback, o listener faz no-op.

**Motivação**: evita condicional duplicada e facilita testes. O listener valida a existência da tabela internamente.

### 7. Recorrência na projeção — modelo de replicação explícita

**Decisão**: para cada mês projetado, o motor filtra `movimentacoes` onde:
- `data_original <= último_dia_do_mês` E
- `recorrente = true` E
- `data_fim IS NULL OR data_fim >= primeiro_dia_do_mês`

Para cada uma, calcula o dia de ocorrência no mês usando a regra "mesmo dia do mês; se o mês não tem esse dia, usar o último dia do mês" (consistente com a geração de parcelas de dívida em `debt-management`).

**Alternativa**: pré-materializar todas as ocorrências futuras em uma tabela `movimentacoes_projetadas`. *Contra*: replica o problema da Decisão 1 (explosão de linhas) e conflita com edições no futuro (mudança de valor precisa recalcular todas as ocorrências).

**Por quê**: manter a recorrência como **regra**, não como dados, evita sincronização tripla.

### 8. Limite diário independente e sem cache

**Decisão**: `GET /contas/{contaId}/limite-diario` calcula em tempo real, sem tocar em `projecao`. A rota faz 2–3 queries simples (`sum(valor) FROM movimentacoes`, `sum(valor) FROM parcelas_divida`) e entrega o resultado com `calculado_em`.

**Por quê**: o limite é uma função do "agora" (saldo real + despesas fixas pendentes restantes no mês). Cachear traz invalidação extra sem ganho — a query é barata com os índices certos (`conta_id + data`, `parcelas_divida.data_vencimento`).

### 9. Arredondamento e precisão numérica

**Decisão**: usar a biblioteca do projeto para cálculos monetários (ou `drizzle`/`postgres` com `DECIMAL(12,2)`). Nas somas em memória durante o cálculo do mês, operar com `bigint` em centavos e converter para `DECIMAL` apenas na serialização. Arredondamento `HALF_EVEN`.

**Risco**: confusão entre ponto flutuante e `DECIMAL` — já existe em `debt-service.ts`; reutilizar o helper de soma existente ou criar um `money.ts` compartilhado.

### 10. Estrutura de arquivos

```
src/
  lib/
    event-bus.ts                      # singleton EventEmitter tipado
    money.ts                          # helpers HALF_EVEN se ainda não houver
  services/
    projection-engine/
      index.ts                        # registra listener + exporta recalcular/resolve
      calculator.ts                   # função pura dia-a-dia
      cascade.ts                      # recursão + limite de 12 meses
      reserve-indicator.ts            # cor + sobra_real + reserva_ideal
      persistence.ts                  # UPSERT/read em `projecao`
    projection-invalidation.ts        # evolui: UPDATE real + emit evento
    goal-service.ts                   # UPSERT em `meta`
    daily-limit-service.ts            # cálculo do limite diário
  routes/
    projections.ts                    # GET /projecao
    goals.ts                          # POST /metas
    accounts.ts                       # adiciona GET /contas/{id}/limite-diario
  db/
    schema.ts                         # adiciona projecao + meta
    migrations/                       # novas SQL geradas por drizzle-kit
```

## Risks / Trade-offs

- **Cluster mode: recálculo duplicado** → mitigado por idempotência do UPSERT + `recalculado_em` observável no frontend. Documentado como aceitável no MVP.
- **EventEmitter perde eventos se o processo crashar entre a resposta HTTP e a execução do listener** → mitigado pelo fato de que `status='invalidada'` persiste no banco; qualquer `GET /projecao` subsequente redispara o recálculo sob demanda. Não há perda funcional.
- **Cascata de 12 meses pode ser longa** → o UPSERT dentro do loop é uma transação por mês; na pior das hipóteses, 12 transações sequenciais (~dezenas de ms cada). Aceitável. Se virar gargalo, migrar para uma única transação com `WITH RECURSIVE` fica como follow-up.
- **Mudança de `saldo_inicial` invalida tudo** → custo operacional real caso a conta tenha muitas projeções. Aceitável no MVP porque é uma ação rara; o usuário que clica em "ajustar saldo" espera recálculo.
- **`reserva_ideal` baseada em receitas brutas do mês projetado** pode oscilar mensalmente se receitas variam → aceitável; o `plano.md` § 6.4 é explícito sobre isso.
- **Precisão numérica em JS** → mitigação: trabalhar em centavos (`bigint`) durante o cálculo e converter apenas para serialização; nunca somar `number` float diretamente.
- **Ordem de cálculo vs. ordem de invalidação** → se dois events para o mesmo `(contaId, mes)` disparam em paralelo, o banco serializa via UPSERT. Último grava vence, mas como o input é o mesmo DB, o resultado converge.

## Migration Plan

1. **Preparar schema** (reversível): gerar migration Drizzle adicionando `projecao` e `meta`. Validar com `drizzle-kit` localmente, rodar no compose.
2. **Ativar invalidação real**: atualizar `src/services/projection-invalidation.ts` para fazer o UPDATE real e emitir `projecao:recalcular`. Testes existentes de movimentações/dívidas/pagamentos passam a observar `status='invalidada'` no banco real.
3. **Introduzir `eventBus` e listener**: criar `src/lib/event-bus.ts` e registrar o listener durante o bootstrap. Como o listener ainda depende do motor, desenvolver este módulo em paralelo; até o motor ficar pronto, o listener faz log-only no-op.
4. **Implementar motor de projeção** (`projection-engine/`) e cobrir com testes de integração (cascata, cache, 12 meses). O listener passa a chamar `recalcular()`.
5. **Expor `GET /projecao`**, `POST /metas`, `GET /contas/{id}/limite-diario`, cada um com sua suíte de testes.
6. **Atualizar coleção `.posting/`** com os novos endpoints.
7. **Rodar `npm run test`** (docker-compose.test.yml) garantindo que a suíte integral passa.
8. **Checkpoint manual**: executar a coleção `.posting/` contra o docker local para o fluxo completo (cria conta → meta → movimentações → dívida → pagamento → projeção → limite diário).

**Rollback**: reverter a migration (`drop table projecao; drop table meta;`). O código das etapas anteriores continua funcional porque `projection-invalidation.ts` já lida com `42P01`. Reverter o commit com o motor desativa `GET /projecao` e rotas novas. Nenhum dado de movimentação/conta/dívida é tocado.

## Open Questions

- **Fuso horário**: o `plano.md` não define UTC vs. local para `mes_referencia` do limite diário e para a derivação de `YYYY-MM` a partir de `data`. **Proposta**: tratar tudo como UTC (consistente com o que as migrations já fazem). Validar com o usuário antes de aplicar.
- **Ordem dos dias em recorrência que cai no dia 29–31**: a regra "último dia do mês quando o dia não existe" cobre bissextos. Confirmar que o service de dívida já faz isso (sim, já está no spec de `debt-management`).
- **Emissão de evento em rotas que ainda não existem**: `POST /metas` e `PATCH /contas/{id}` (saldo_inicial) precisam emitir `projecao:recalcular`. Já coberto pelas specs de `emergency-reserve-goal` e `account-management` (modified).
- **Limite diário com `dias_restantes_no_mes = 0`**: definido na spec como retornar `saldo_disponivel` (ou 0 se negativo). Confirmar com o usuário se prefere outro comportamento.

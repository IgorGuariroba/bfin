## Context

A rota `GET /contas/{contaId}/limite-diario` e as tools MCP `daily-limit_get` / `daily-limit_set` foram introduzidas no MVP. Com a entrega de `add-daily-limit-v2`, a superfície v1 vira redundante:

- `daily-limit_get` mantém cálculo complexo que duplica `projection-engine` e degenera no fim do mês.
- `daily-limit_set` é código morto: grava `porcentagem_reserva` em `metas` via `upsertMeta` mas o cálculo de limite diário nunca lê esse campo. A mesma operação é oferecida por `goals_create`/`goals_update` (MCP) e `PUT /metas` (HTTP).

A deprecação precisa ser formalizada para permitir remoção futura sem quebrar consumidores ativos.

## Goals / Non-Goals

**Goals:**
- Sinalizar deprecação da rota v1 e das duas tools MCP sem alterar comportamento.
- Estabelecer data absoluta de sunset (= merge + 90 dias) e propagá-la para headers HTTP, `description` das tools, docs e spec.
- Direcionar consumidores para os substitutos corretos (`/limite-diario-v2`, `daily-limit_v2_get`, `goals_create`/`goals_update`).
- Preservar 100% do payload/comportamento atual durante o sunset.

**Non-Goals:**
- Remoção de código, rotas, tools ou spec requirements (cobrado em change futura pós-sunset).
- Alteração do cálculo v1 ou da tabela `metas` / `porcentagem_reserva`.
- Migração automática de clientes — responsabilidade dos consumidores durante o sunset.
- Alerta ativo/telemetria de uso de v1 (pode ser agregado em change dedicada se necessário).

## Decisions

### 1. Sunset de 90 dias absolutos, fixado no merge

**Escolha:** computar a data de sunset no momento da implementação (dia do merge + 90 dias) e cravá-la em todos os artefatos: header `Sunset`, `description` das tools, `docs/mcp.md`, nota do spec. Usar formato ISO 8601 UTC (`YYYY-MM-DDT00:00:00Z`) no header e `YYYY-MM-DD` nos textos.

**Alternativas consideradas:**
- Data relativa ("+90d desde o último deploy") — inviável no HTTP header; confunde integradores.
- Sunset calculado dinamicamente no handler — adiciona complexidade sem benefício.

**Rationale:** RFC 8594 exige `HTTP-date` absoluto. Centralizar a data em uma constante (`const DAILY_LIMIT_V1_SUNSET = "YYYY-MM-DDT00:00:00Z"`) permite referenciar do mesmo lugar em rota + tools.

### 2. Headers `Deprecation` + `Sunset` + `Link` (RFC 8594 + RFC 9745)

**Escolha:** aplicar três headers no handler v1:
- `Deprecation: true` (RFC 9745)
- `Sunset: <HTTP-date>` (RFC 8594)
- `Link: </contas/{contaId}/limite-diario-v2>; rel="successor-version"` (RFC 8288)

**Alternativas consideradas:**
- Apenas `Warning` header — obsoleto (RFC 7234 removeu em RFC 9111).
- Campo `deprecated: true` no body — quebra contrato sem ganho.

**Rationale:** conjunto padrão da indústria; clientes modernos detectam automaticamente.

### 3. Prefixar `description` das tools MCP

**Escolha:** prefixar `description` de `dailyLimitGet` e `dailyLimitSet` com `[DEPRECATED — use <substituto>; sunset YYYY-MM-DD] ` mantendo o texto original em seguida.

**Alternativas consideradas:**
- Adicionar campo `deprecated: true` no `McpTool` — exige mudança de tipo + tooling cliente; out of scope.
- Emitir warning no stdout — polui o transporte STDIO do MCP.

**Rationale:** campo `description` é o único canal visível ao cliente MCP hoje; prefixação é não-disruptiva.

### 4. Spec delta via MODIFIED com nota de deprecação

**Escolha:** usar `## MODIFIED Requirements` no spec delta, copiando integralmente cada requirement v1 e adicionando uma nota (bloco `> **DEPRECATED (sunset YYYY-MM-DD):** ...`) no topo da descrição. Cenários permanecem idênticos.

**Alternativas consideradas:**
- `## REMOVED Requirements` — removeria cenários dos testes, quebrando paridade durante o sunset.
- Criar capability separada `daily-spending-limit-v1` — ruptura desnecessária; v1 e v2 coexistem temporariamente na mesma capability.

**Rationale:** MODIFIED preserva 100% do conteúdo para archival; REMOVED só faz sentido quando o código é efetivamente removido (change futura).

### 5. `daily-limit_set` apontando para `goals_*`

**Escolha:** a nota de deprecação de `daily-limit_set` indica `goals_create`/`goals_update` como substitutos (não `daily-limit_v2_get`).

**Rationale:** v2 é read-only; a operação real de `daily-limit_set` sempre foi `upsertMeta`. Documentar a equivalência honesta evita confusão.

## Risks / Trade-offs

- **Clientes não tratam headers `Deprecation`/`Sunset`**: maioria dos integradores atuais lê payload, não headers. **Mitigação:** anúncio explícito em canais externos + menção em `docs/mcp.md`. Custo de esforço baixo; benefício de estabilidade alto.
- **Sunset de 90 dias curto para integrações externas lentas**: em caso real de reclamação, postergar via change suplementar. **Mitigação:** nota explícita na change futura de remoção que 90 dias é o baseline — pode ser estendido se houver bloqueio comprovado.
- **Spec com duas versões simultâneas (v1 deprecada + v2 ativa) pode confundir novos contribuidores**: **Mitigação:** bloco de DEPRECATED nos requirements v1 é visualmente destacado; `docs/mcp.md` e `proposal.md` deixam claro qual é o caminho novo.

## Migration Plan

1. Confirmar que `add-daily-limit-v2` já foi mergeado e deployado antes de implementar esta change.
2. Fixar `DAILY_LIMIT_V1_SUNSET` como constante (`YYYY-MM-DDT00:00:00Z`, = data de merge + 90 dias).
3. Atualizar handler v1 em `src/routes/accounts.ts` para setar headers `Deprecation`, `Sunset`, `Link`.
4. Atualizar `description` de `dailyLimitGet` e `dailyLimitSet` em `src/mcp/tools/daily-limit.ts`.
5. Atualizar `docs/mcp.md` e referências externas à rota v1.
6. Atualizar spec via delta MODIFIED (nota de deprecação nos requirements existentes).
7. Agendar change de remoção para depois do sunset — registrar como TODO fora deste repo ou via `/schedule`.

**Rollback:** reverter commit. V1 e v2 continuam convivendo sem headers de deprecação.

## Open Questions

- **Telemetria do uso de v1 durante o sunset** (log estruturado com user/account ID a cada hit): necessária para saber se ainda há tráfego próximo da data? Sugestão: deixar para change separada se demanda aparecer. Por padrão, sem telemetria extra nesta change.

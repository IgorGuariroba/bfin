## Why

Com a change `add-daily-limit-v2` introduzindo `GET /contas/{contaId}/limite-diario-v2` e a tool MCP `daily-limit_v2_get` com regra simples e correta (`saldo_atual / 30`), a v1 (`GET /contas/{contaId}/limite-diario`, tool `daily-limit_get`) e a tool de configuração (`daily-limit_set`) passam a ser redundantes ou enganosas:

- **v1 duplica `projection-engine`** (parcelas, recorrentes futuras).
- **v1 degenera no fim do mês** (`dias_restantes = 1` → gasta tudo num dia).
- **`daily-limit_set` é código morto**: grava `porcentagem_reserva` em `metas` via `upsertMeta`, mas nenhum cálculo de `daily-spending-limit` lê esse campo. A operação já é oferecida por `goals_create`/`goals_update` e pela rota `PUT /metas`.

Deprecar formalmente com sunset de 90 dias dá tempo aos integradores migrarem sem quebrar clientes em produção. A remoção do código acontece em uma change futura após o sunset.

## What Changes

- **DEPRECATED** rota `GET /contas/{contaId}/limite-diario`: continua funcional; resposta passa a incluir headers `Deprecation: true` e `Sunset: <data absoluta = merge + 90 dias>` e `Link: </contas/{contaId}/limite-diario-v2>; rel="successor-version"`.
- **DEPRECATED** MCP tool `daily-limit_get`: `description` passa a prefixar `[DEPRECATED — use daily-limit_v2_get; sunset YYYY-MM-DD]` sem alterar o contrato de entrada/saída.
- **DEPRECATED** MCP tool `daily-limit_set`: `description` passa a prefixar `[DEPRECATED — use goals_create/goals_update; sunset YYYY-MM-DD]`. Comportamento inalterado até a remoção.
- **BREAKING (no final do sunset, em change futura)**: remoção completa da rota v1, das duas tools e do serviço `daily-limit-service.ts`. **Esta change NÃO remove nada** — apenas sinaliza.
- Documentação (`docs/mcp.md`, READMEs) atualizada para apontar v2 como caminho recomendado.
- Spec `daily-spending-limit` atualizada: requirements v1 marcados com nota de deprecação em MODIFIED (mantendo conteúdo íntegro) — remoção formal via REMOVED em change futura.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `daily-spending-limit`: marca formalmente como deprecados o endpoint v1, a tool `daily-limit_get` e a tool `daily-limit_set`. Requirements existentes ganham nota de deprecação com data de sunset; comportamento inalterado até a change de remoção.

## Impact

**Código alterado:**
- `src/routes/accounts.ts` — handler v1 passa a emitir headers `Deprecation`, `Sunset`, `Link`.
- `src/mcp/tools/daily-limit.ts` — `description` de `dailyLimitGet` e `dailyLimitSet` com prefixo `[DEPRECATED ...]`.
- `docs/mcp.md` — destaca v2; v1 marcada como deprecada com data de sunset.
- Eventuais docs de API que referenciem `/limite-diario`.

**Código intocado:**
- Lógica interna de `src/services/daily-limit-service.ts`.
- `goal-service.ts`, `projection-engine`, coluna `porcentagem_reserva`.
- Rota/tool v2 (introduzidas em `add-daily-limit-v2`).

**Dependência:** esta change requer que `add-daily-limit-v2` esteja mergeada antes do deploy (sucessor precisa existir para o header `Link: rel=successor-version` ser válido).

**Sunset:** **90 dias após o merge** desta change. A data absoluta será fixada como parte da implementação (commit/PR) e refletida na `description` das tools, no header `Sunset`, no `docs/mcp.md` e na nota de deprecação do spec.

**Comunicação:** anunciar a deprecação no canal onde integradores recebem atualizações (referências externas fora do escopo do repo).

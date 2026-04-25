## Why

O cálculo atual do limite diário (`calcularLimiteDiario` em `src/services/daily-limit-service.ts`) mistura saldo realizado, recorrentes futuras do mês e parcelas de dívida do mês corrente dentro de uma janela fixa (mês do calendário). Isso causa dois problemas:

1. **Final de mês degenerado**: `dias_restantes = 1` faz o limite virar "gaste tudo hoje", violando a intenção de preservar saldo até o próximo recebimento.
2. **Sobreposição de responsabilidade**: parcelas e recorrentes já são tratadas pelo `projection-engine` (visão mensal completa). Limite diário deveria responder uma pergunta simples — "quanto posso gastar hoje sem secar a conta nos próximos 30 dias?" — sem duplicar lógica de projeção.

A regra v2 é trivial e segura: `saldo_atual / 30`, recalculada toda consulta. Janela móvel garante horizonte estável. Responsabilidades ficam separadas: limite diário = controle do dia; projeção = visão de médio prazo.

## What Changes

- **NEW** rota HTTP `GET /contas/{contaId}/limite-diario-v2` com regra simples (saldo realizado até hoje dividido por 30).
- **NEW** MCP tool `daily-limit_v2_get` com mesmo cálculo.
- **NEW** serviço `src/services/daily-limit-v2-service.ts` (~15 linhas).
- **NEW** contrato de resposta: `{ contaId, janela_inicio, janela_fim, horizonte_dias, saldo_atual, limite_diario, calculado_em }`.
- Autorização idêntica à v1: `Auth Guard` + middleware de autorização por conta; `owner` e `viewer` consultam; sem vínculo → 403; conta inexistente → 404.
- Cálculo sempre em tempo real, sem cache.

**Fora de escopo (changes futuras):**
- Deprecação e remoção da rota/tool v1 → `deprecate-daily-limit-v1`.
- Remoção de `daily-limit_set` (duplicata de `goals_create`/`goals_update`) → mesma change de deprecação.
- Alterações em `projection-engine`, `goals`, ou na coluna `porcentagem_reserva`.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `daily-spending-limit`: adiciona requirement para a rota/tool v2 com janela móvel de 30 dias e cálculo simplificado (saldo realizado ÷ 30). Requirements existentes (v1) permanecem inalterados nesta change — serão marcados como deprecated em change separada.

## Impact

**Código novo:**
- `src/services/daily-limit-v2-service.ts` — novo serviço.
- `src/routes/accounts.ts` (ou arquivo correspondente) — registra rota `GET /contas/:contaId/limite-diario-v2`.
- `src/mcp/tools/daily-limit.ts` — adiciona export `dailyLimitV2Get`.
- `src/mcp/tools/index.ts` — registra nova tool.
- Testes unitários do novo serviço + testes manuais em `.posting/`.

**Código intocado nesta change:**
- Rota v1 e tools `daily-limit_get`/`daily-limit_set` continuam funcionando.
- `src/services/daily-limit-service.ts` permanece.
- `projection-engine`, `goals`, coluna `porcentagem_reserva`.

**Dependências:** nenhuma nova. Usa tabelas e helpers existentes (`contas`, `movimentacoes`, `categorias`, `tipoCategorias`, `toCents`/`fromCents`/`roundCentsHalfEven`).

**Documentação:** atualizar `docs/mcp.md` com a nova tool; mencionar a rota v2 onde a v1 for referenciada.

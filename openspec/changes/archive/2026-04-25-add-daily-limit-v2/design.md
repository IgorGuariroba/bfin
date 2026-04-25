## Context

A capability `daily-spending-limit` existe desde o lançamento do MVP e expõe:
- rota HTTP `GET /contas/{contaId}/limite-diario`
- tool MCP `daily-limit_get`
- tool MCP `daily-limit_set` (duplicata de `goals_create`/`goals_update`, grava `porcentagem_reserva` em `metas` sem que nada leia)

A lógica v1 (`src/services/daily-limit-service.ts`) divide `saldo_disponivel` por `dias_restantes_no_mes`, subtraindo recorrentes futuras do mês e parcelas de dívida do mês corrente. Isso:

- Duplica parte do `projection-engine`, que já calcula parcelas pendentes com cascata mensal.
- Degenera no fim do mês (`dias_restantes = 1` → gasta tudo em um dia).
- Não garante a intenção declarada pelo usuário: "sempre ter dinheiro até o próximo recebimento".

O serviço ainda carrega `porcentagem_reserva` como *dead code* (tool `daily-limit_set` grava, mas o cálculo ignora — spec atual inclusive obriga "independência da meta de reserva").

## Goals / Non-Goals

**Goals:**
- Introduzir uma rota e tool MCP v2 com cálculo trivial: `max(0, saldo_atual) / 30`.
- Janela móvel fixa de 30 dias (`[hoje, hoje+30]`), recalculada em tempo real a cada consulta.
- Segregar responsabilidades: limite diário responde "quanto hoje"; projeção responde "como o mês fecha".
- Preservar 100% das rotinas de autorização da v1 (Auth Guard + middleware de conta).
- Zero alteração de comportamento em v1, `projection-engine`, `goals` e coluna `porcentagem_reserva`.

**Non-Goals:**
- Deprecação formal ou remoção de v1 (change futura `deprecate-daily-limit-v1`).
- Remoção de `daily-limit_set` (change futura).
- Integração com metas de reserva, cálculo de reserva ideal, ou qualquer consumo de `porcentagem_reserva`.
- Cache de resultado (rota continua real-time, sem persistência).

## Decisions

### 1. Endpoint separado (`/limite-diario-v2`) em vez de versionar header ou query param

**Escolha:** path distinto, `/contas/{contaId}/limite-diario-v2`.

**Alternativas consideradas:**
- `Accept-Version: 2` header — obscurece a coexistência; exige mudança em cliente para distinguir; não aparece em logs sem inspeção.
- `?version=2` query — mistura payloads num mesmo handler; complica validação Zod.

**Rationale:** path distinto é explícito, trivial de documentar, permite deprecar v1 com header `Sunset` sem ambiguidade, e mantém handlers isolados (fácil de remover v1 depois).

### 2. Tool MCP nomeada `daily-limit_v2_get`

**Escolha:** sufixo `_v2_` no meio do nome (prefixo `daily-limit`, verbo `get`).

**Alternativas consideradas:**
- `daily-limit_get_v2` — pós-fixar o verbo dificulta discoverability por prefixo.
- `daily-spending_get` — renomeia capability implicitamente; diverge do nome da spec.

**Rationale:** mantém convenção de tools MCP do projeto (`<capability>_<operation>`), sinaliza versão no meio para agrupar com `daily-limit_get` no autocomplete, e deixa claro que ambas compartilham a mesma capability.

### 3. Serviço isolado (`daily-limit-v2-service.ts`)

**Escolha:** novo arquivo em vez de função exportada adicional no serviço v1.

**Alternativas consideradas:**
- Adicionar `calcularLimiteDiarioV2` no mesmo arquivo.
- Parametrizar `calcularLimiteDiario` com flag `versao`.

**Rationale:** isolamento físico facilita a remoção da v1 (basta apagar o arquivo antigo). Função parametrizada ampliaria superfície de teste sem ganho. Código novo é ~15 linhas — não justifica compartilhamento.

### 4. Janela de 30 dias no payload, mas não no cálculo

**Escolha:** `janela_inicio = hoje`, `janela_fim = hoje + 30`, `horizonte_dias = 30` expostos como metadados; cálculo usa apenas `saldo_atual / 30`.

**Alternativas consideradas:**
- Somar recorrentes/parcelas da janela ao cálculo — rejeitado pelo usuário (projeção cuida disso).
- Omitir `janela_*` do payload — perde contexto para o cliente entender o horizonte.

**Rationale:** campos de janela comunicam a intenção ao consumidor sem modificar a regra aritmética. Mantém resposta autoexplicativa.

### 5. Arredondamento `HALF_EVEN` em centavos com `roundCentsHalfEven`

**Escolha:** reutiliza helper existente de `src/lib/money.ts`, consistente com v1 e projeção.

**Rationale:** evita divergência entre capabilities; `HALF_EVEN` (bankers' rounding) é o padrão adotado no projeto.

### 6. Sem cache, sem persistência

**Escolha:** GET sempre recalcula; não grava em tabela.

**Rationale:** cálculo é uma soma simples + uma divisão; custo desprezível. Cache criaria risco de staleness após `transactions_create`/`transactions_update`/`transactions_delete`. Spec v1 já exige real-time — mantém paridade.

## Risks / Trade-offs

- **Coexistência de duas rotas/tools**: confusão temporária para integradores. **Mitigação:** change de deprecação imediatamente após esta (`deprecate-daily-limit-v1`) com `Sunset: +90d` e atualização de `docs/mcp.md`.
- **"Choque" no limite quando uma despesa grande cai**: usuário pode ver `R$100/dia` num dia e `R$10/dia` no seguinte após débito de aluguel. **Mitigação:** projeção mensal continua como visão complementar; UX deve expor ambos. Fora do escopo desta change.
- **Horizonte fixo de 30 dias não alinha com ciclos de recebimento reais (ex: quinzenais, bissemanais)**: cálculo é aproximação conservadora. **Mitigação:** documentado como v2; se necessário, uma v3 futura pode parametrizar o horizonte ou detectar recorrentes de receita.
- **Saldo atual calculado via `data <= now` pode conflitar com timezone do usuário**: `now` é UTC. **Mitigação:** v1 já opera em UTC; v2 mantém paridade. Escopo de timezone-awareness é capability separada.

## Migration Plan

1. Implementar serviço, rota e tool v2 (additive; nada quebra).
2. Adicionar testes unitários e integração para v2.
3. Adicionar casos manuais em `.posting/` para o novo endpoint.
4. Atualizar `docs/mcp.md` listando a nova tool ao lado de `daily-limit_get`.
5. Deploy normal via CI/CD; sem migration de banco.

**Rollback:** reverter commit; v1 e projeção intocadas.

## Open Questions

Nenhuma neste momento. Escopo fechado em conversa prévia: cálculo, contrato, autorização e nomes já alinhados.

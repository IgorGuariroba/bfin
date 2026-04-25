## Context

Esta change não introduz capability nova nem altera código de produção. Documenta o processo de submissão e os artefatos de rastreamento. Depende de `add-mcp-directory-tech-compliance` e `add-mcp-directory-content` estarem `archive`-ready ou pelo menos com tasks essenciais concluídas.

## Goals / Non-Goals

**Goals:**
- Submeter ao Anthropic Connectors Directory com pacote completo.
- Registro auditável (data submissão, IDs de tickets, feedback do reviewer, decisão final).
- Plano de resposta para "changes requested".

**Non-Goals:**
- Submissão a outros diretórios (OpenAI, Microsoft) — change separada.
- Marketing pós-aprovação.
- Implementação de mudanças solicitadas pelo reviewer (capturadas em changes follow-up se exigirem código).

## Decisions

### Decision: Form único — Remote MCP directory submission form
Escolher o form de **Remote MCPs** (não Desktop extension) pois o bfin opera servidor HTTP remoto. Documentar URL do form no `docs/mcp-submission-package.md`.

### Decision: Allowed link URIs declarados
Origins HTTPS confirmados:
- `https://api.bfincont.com.br`
- `https://app.bfincont.com.br` (se existir UI)
Esquemas custom: nenhum por enquanto.

### Decision: Status tracking em `docs/mcp-submission-status.md`
Tabela com colunas: data, status, evento, ticket/email, ação. Atualizada em cada interação.

### Decision: Janela de resposta a changes requested ≤ 5 dias úteis
Compromisso interno: PR de ajuste em até 5 dias úteis após feedback. Casos complexos (security re-review) ganham change separada.

## Risks / Trade-offs

- **Risco:** Reviewer rejeita por gap nas changes 1/2 não previsto. → Mitigação: rodar `npm run mcp:check-submission` antes de submeter; testar com MCP Inspector como reviewer faria.
- **Risco:** Aprovação demora semanas. → Mitigação: aceitar (Anthropic não oferece expedited review). Trabalho paralelo na submissão OpenAI fica em change separada.
- **Risco:** Reviewer pede mudança que viola escopo do bfin (ex.: remover tool destrutiva). → Mitigação: avaliar; se inviável, documentar em `docs/mcp-submission-status.md` como "Withdrawn" e seguir uso interno.

## Open Questions

- Tagline final?
- Quais 3-5 casos de uso destacar (entre: agente que registra gastos, projeção de saldo, alerta de meta, controle de dívida, daily-limit)?
- Política para feedback do reviewer que toca em segurança: revelar mais ou menos detalhe interno?

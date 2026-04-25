## Context

OpenAI ChatGPT Apps SDK (beta em 2026-04) aceita MCP connectors via processo de review manual. Sobreposição grande com Anthropic Directory mas com especificidades. Esta change só faz sentido após `add-mcp-directory-tech-compliance` e `add-mcp-directory-content` estarem implementadas — herda quase tudo dali.

## Goals / Non-Goals

**Goals:**
- Servidor MCP do bfin aprovado também no diretório OpenAI.
- Anotações estendidas (`openWorldHint`) sem regressão para clientes Anthropic.
- Auditoria de "verbo específico" em nomes de tools.
- Tracking separado do submission OpenAI.

**Non-Goals:**
- Re-redigir privacy policy específica para OpenAI (a mesma serve).
- Re-criar demo account (a mesma serve).
- Mudar contrato de erro (já compatível).
- Submeter primeiro à Anthropic ou OpenAI — pode ser paralelo.

## Decisions

### Decision: `openWorldHint` por classificação semântica
Tools cujo efeito está totalmente contido no domínio bfin (DB local) recebem `openWorldHint: false`. Tools cujo efeito atravessa fronteira para serviço externo não-determinístico (ex.: chamadas a Auth0, integrações futuras com bancos via Open Finance) recebem `openWorldHint: true`. Hoje todas as tools são `false` exceto `mcp_whoami` (que consulta Auth0): também `false` porque é leitura idempotente do próprio principal.

**Alternativa considerada:** marcar todas como `false`. Aceitável agora, mas helper deve permitir override por tool para evolução.

### Decision: Lint de "verbo específico"
Adicionar regra ao `mcp:audit-descriptions` que exige primeira palavra da description ser verbo de ação (allowlist: `List`, `Get`, `Create`, `Update`, `Delete`, `Set`, `Pay`, `Add`, `Remove`, `Project`, `Verify`, `Resolve`). Bloqueia descrições genéricas como "Tool for ..." ou "Manages ...".

**Alternativa considerada:** revisão manual. Rejeitada — drift recorrente.

### Decision: Submissão paralela ou sequencial?
**Sequencial preferido**: submeter Anthropic primeiro, esperar aprovação ou changes-requested. Razão: feedback do reviewer Anthropic pode pegar problemas que invalidariam OpenAI também. Após aprovação Anthropic, submeter OpenAI imediatamente.

**Alternativa considerada:** paralelo. Aceitável se urgência alta, mas dobra risco de iteração se um pedir ajuste que afete o outro.

### Decision: Tracking separado em `docs/mcp-submission-status.md`
Mesmo arquivo, mas seções separadas `## Anthropic` e `## OpenAI`. Histórico unificado facilita auditoria.

## Risks / Trade-offs

- **Risco:** OpenAI rejeita por bfin tocar finanças (mesmo sem processar cartão/transferência real). → Mitigação: descrição enfatiza "registro e projeção", explícito não-transferência, no submission form.
- **Risco:** Demo account com MFA acidentalmente ativado bloqueia review. → Mitigação: checklist no `mcp:check-submission` valida ausência de MFA via API Auth0.
- **Risco:** Padrões de naming OpenAI vs Anthropic divergem. → Mitigação: hoje ambos aceitam snake_case com verbo + recurso (`transactions_list`); manter padrão atual.

## Open Questions

- OpenAI Apps SDK aceita conector MCP remoto OAuth puro, ou exige handshake adicional pelo Apps SDK? Verificar `developers.openai.com/api/docs/guides/tools-connectors-mcp` antes de submeter.
- Categoria do app no diretório OpenAI: "Productivity"? "Finance"?
- Submeter como app individual ou organizacional? OpenAI exige verified developer.

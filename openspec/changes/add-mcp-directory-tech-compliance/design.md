## Context

O servidor MCP atual (`src/mcp/server.ts`) opera em modo STDIO + (em produção) HTTP+SSE atrás do Caddy em `api.bfincont.com.br/mcp`, com OAuth Auth0 já no fluxo. As tools estão registradas em `src/mcp/tools/` e o registry filtra por escopo. Spec atual `mcp-server` cobre comportamento funcional mas não expressa requisitos de diretório público (annotations, Origin guard, hardening de descrição, contrato de erro estruturado).

Anthropic Connectors Directory exige:
- `title` em toda tool, `readOnlyHint: true` (read) ou `destructiveHint: true` (write).
- Read/write split: nenhuma tool combina semântica safe e unsafe.
- Origin header validation no transport HTTP (DNS rebinding).
- Descrições sem prompt injection nem promo.
- Contrato de erro acionável (estruturado).
- Escopos OAuth mínimos por tool.

O escopo aqui é meta+transport+contrato, não comportamento de domínio.

## Goals / Non-Goals

**Goals:**
- Tools satisfazem critérios técnicos da Anthropic Directory (`readOnlyHint`/`destructiveHint`, `title`, ≤64 chars).
- Transport HTTP+SSE valida Origin contra allowlist configurável.
- Erros de `tools/call` retornam estrutura padronizada (campo, motivo, código) tanto para validação quanto domínio.
- Descrições de tools auditadas, sem prompt injection, sem promo.
- Escopos Auth0 revisados para least-privilege documentado.

**Non-Goals:**
- Mudar comportamento funcional de qualquer tool (assinatura, side effects, schema de input).
- Migrar nomenclatura de tools (`accounts_create` ↔ `accounts.create`) — discrepância spec/realidade fica para change separada.
- Cobrir requisitos não-técnicos (privacy policy, branding, demo account, doc pública, submissão em si) — endereçados em `add-mcp-directory-content` e `submit-mcp-anthropic-directory`.
- Submeter ao OpenAI Apps SDK (change separada).

## Decisions

### Decision: Annotation map por convenção de nome de tool
Tools cuja ação é `list`, `get` ou `whoami` recebem `readOnlyHint: true`. Tools cuja ação é `create`, `update`, `delete`, `set`, `pay-installment`, `add` recebem `destructiveHint: true`. `title` é derivado da convenção `<Domain> <action verb humanizado>` (ex.: "List Transactions", "Create Account").

**Alternativa considerada:** declarar manualmente por tool. Rejeitada — cresce com o catálogo e gera drift. Convenção centralizada num helper `withAnnotations(tool)` é mais robusta.

### Decision: Origin guard como middleware do transport HTTP
Implementar guard no transport (Fastify plugin ou middleware do MCP HTTP server) que rejeita conexões cujo header `Origin` não bate allowlist `MCP_ALLOWED_ORIGINS` (CSV de origens permitidas). Default seguro: rejeita ausência de header em produção; aceita em dev se `NODE_ENV !== "production"`.

**Alternativa considerada:** confiar no Caddy. Rejeitada — defesa em profundidade, e MCP transport pode rodar em dev sem Caddy.

### Decision: Contrato de erro estruturado
Erro de `tools/call` retorna `isError: true` com `content[0].text` contendo JSON estável: `{ code, message, field?, hint? }`. Códigos: `INVALID_INPUT`, `NOT_FOUND`, `FORBIDDEN`, `BUSINESS_RULE`, `INTERNAL`. Validação Zod popula `field` apontando o caminho do erro.

**Alternativa considerada:** usar somente `message` em texto livre. Rejeitada — quebra contrato máquina-legível e dificulta tooling de cliente.

### Decision: Hardening de descrição via lint regex
Adicionar lint script `npm run mcp:audit-descriptions` que varre `src/mcp/tools/**` e falha se descrição contém padrões suspeitos: `ignore`, `system prompt`, `override`, `must call`, `always invoke`, `disregard`, URLs externas em descrição, linguagem promocional ("best", "amazing", "powerful"). Lista mantida em `src/mcp/tools/__lint__/banned-phrases.ts`.

**Alternativa considerada:** revisão manual única. Rejeitada — drift volta no próximo PR sem proteção automática.

### Decision: Escopos Auth0 revisados em `src/mcp/scopes.ts`
Cada tool declara `requiredScope` no formato `<resource>:<action>` onde action ∈ {`read`, `write`, `delete`}. Mapping unificado documentado em comentário do arquivo. Diff aplicado ao tenant Auth0 via change-log no `docs/mcp.md`.

## Risks / Trade-offs

- **Risco:** Origin guard rejeita cliente legítimo cujo Origin não foi adicionado à allowlist. → Mitigação: log estruturado em WARN com Origin recebido, doc clara em `docs/mcp.md`, env var configurável sem rebuild.
- **Risco:** Contrato de erro novo quebra clientes que parseavam texto livre. → Mitigação: campo `message` segue legível; clientes que ignoram JSON funcionam. Comunicado em CHANGELOG.
- **Risco:** Lint de descrição falsamente positivo. → Mitigação: allowlist por exceção comentada; lista ajustada conforme feedback.
- **Risco:** Discrepância entre nomes em spec (`accounts.list`) e MCP real (`accounts_list`) cria confusão na revisão Anthropic. → Mitigação: documentar em `docs/mcp.md` que são aliases; mudança de nome fica fora desta change.

## Migration Plan

1. Implementar helper `withAnnotations` e aplicar a todas as tools.
2. Adicionar Origin middleware com flag `MCP_ALLOWED_ORIGINS` (default em prod = `https://api.bfincont.com.br`).
3. Refatorar `src/mcp/errors.ts` para emitir estrutura padronizada; ajustar handlers.
4. Rodar `npm run test`, `npm run test:hurl` e MCP Inspector contra `mcp:dev`.
5. Atualizar `docs/mcp.md` com seções de annotations, Origin allowlist, contrato de erro.
6. Deploy em produção (CI/CD via GHCR em push pra master). Rollback = revert do commit; sem migration de DB.

## Open Questions

- Qual lista exata de origens dev devem entrar em `MCP_ALLOWED_ORIGINS` (Claude Desktop usa `null` Origin? Inspector usa `http://localhost:6274`?). Resolver durante implementação consultando MCP Inspector + spec.
- Tool `mcp_whoami` é read-only mas retorna info sensível do principal. Confirmar se Anthropic considera aceitável (provavelmente sim, mas anotar como `readOnlyHint: true` + descrição explícita).

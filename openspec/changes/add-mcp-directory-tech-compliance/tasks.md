## 1. Auditoria inicial

- [x] 1.1 Listar tools registradas em `src/mcp/tools/**` e mapear cada uma como read-only ou destrutiva
- [x] 1.2 Verificar tamanho do `name` de cada tool ≤ 64 chars
- [x] 1.3 Identificar tools que combinam semântica safe e unsafe (read/write split)
- [x] 1.4 Coletar descrições atuais e identificar candidatos a hardening (prompt injection, promo)
- [x] 1.5 Mapear `requiredScope` atual de cada tool e divergências contra least-privilege

## 2. Tool annotations

- [x] 2.1 Criar helper `withAnnotations(tool)` em `src/mcp/tools/__shared__/annotations.ts` aplicando `title` derivado e `readOnlyHint`/`destructiveHint` por convenção
- [x] 2.2 Aplicar helper em toda tool de `src/mcp/tools/**`
- [x] 2.3 Adicionar guard no registry que falha boot se tool não tem `title` ou tem 0/2 hints
- [x] 2.4 Atualizar testes vitest do registry cobrindo guard de annotation
- [x] 2.5 Validar via MCP Inspector que `tools/list` expõe `title` + hint correto

## 3. Read/write split + naming

- [x] 3.1 Para cada tool flagada em 1.3, dividir em duas tools distintas (commit por tool)
- [x] 3.2 Renomear tools com nome > 64 chars (caso exista) com nota em `docs/mcp.md`
- [x] 3.3 Adicionar lint `npm run mcp:audit-names` que falha se algum nome > 64 chars

## 4. Origin header validation

- [x] 4.1 Adicionar variável `MCP_ALLOWED_ORIGINS` ao schema de env (`src/config.ts` ou equivalente)
- [x] 4.2 Implementar middleware/plugin de Origin guard no transport HTTP+SSE em `src/mcp/transport/origin-guard.ts`
- [x] 4.3 Default seguro: rejeita ausência em `NODE_ENV=production`, aceita em dev
- [x] 4.4 Log WARN estruturado quando rejeita (origem recebida, path, ip)
- [x] 4.5 Testes vitest para origin permitido / negado / ausente em prod / ausente em dev
- [x] 4.6 Atualizar docker-compose e systemd unit com env var
- [x] 4.7 Atualizar Caddy config se necessário (preservar header Origin upstream)

## 5. Hardening de descrições

- [x] 5.1 Criar lista de padrões banidos em `src/mcp/tools/__lint__/banned-phrases.ts`
- [x] 5.2 Implementar script `scripts/audit-mcp-descriptions.ts` que varre tools e falha em match
- [x] 5.3 Adicionar `mcp:audit-descriptions` ao `package.json`
- [x] 5.4 Revisar cada description atual e reescrever as flagadas (commit por tool)
- [x] 5.5 Adicionar audit ao pre-commit hook em `.githooks/pre-commit`

## 6. Contrato de erro estruturado

- [x] 6.1 Definir tipo `MCPErrorPayload` em `src/mcp/errors.ts` com `code`, `message`, `field?`, `hint?`
- [x] 6.2 Implementar mapper `toMCPError(err)` cobrindo `ZodError`, `NotFoundError`, `BusinessRuleError`, `ForbiddenError`, fallback `INTERNAL`
- [x] 6.3 Refatorar handler central de `tools/call` para serializar JSON estruturado em `content[0].text`
- [x] 6.4 Atualizar testes vitest de cada tool cobrindo cada `code` possível
- [x] 6.5 Estender `.hurl/e2e.hurl` com casos: input inválido, not found, forbidden

## 7. Escopos OAuth

- [x] 7.1 Auditar `src/mcp/scopes.ts` (ou local equivalente) e ajustar `requiredScope` para least-privilege
- [x] 7.2 Documentar mapping completo no topo do arquivo
- [x] 7.3 Atualizar tenant Auth0 com escopos novos (manual; adicionar checklist em `docs/mcp.md`)
- [x] 7.4 Testes vitest para filtro de `tools/list` por escopo

## 8. Documentação

- [x] 8.1 Adicionar seção "Tool annotations" em `docs/mcp.md`
- [x] 8.2 Adicionar seção "Origin allowlist" em `docs/mcp.md`
- [x] 8.3 Adicionar seção "Contrato de erro estruturado" em `docs/mcp.md`
- [x] 8.4 Adicionar seção "Validação via MCP Inspector" com passo-a-passo
- [x] 8.5 Adicionar changelog explicando mudança de contrato de erro

## 9. Validação final

- [x] 9.1 Rodar `npm run test` (vitest dentro do docker-compose.test.yml) verde
- [x] 9.2 Rodar `npm run test:hurl` verde
- [x] 9.3 Rodar `npm run mcp:audit-descriptions` e `npm run mcp:audit-names` verde
- [x] 9.4 Rodar MCP Inspector contra `mcp:dev` cobrindo todas as tools
- [ ] 9.5 Smoke em produção: `scripts/test-mcp-http.sh` contra api.bfincont.com.br/mcp

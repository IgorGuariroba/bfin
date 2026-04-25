## Why

O servidor MCP do bfin (`src/mcp/server.ts`) hoje atende clientes internos, mas falha critérios técnicos do Anthropic Connectors Directory: tools sem `title`/`readOnlyHint`/`destructiveHint`, transport sem validação de header `Origin`, possíveis descrições com risco de prompt injection, contrato de erro inconsistente e escopos OAuth não auditados. Sem esses ajustes a submissão é rejeitada na primeira revisão.

## What Changes

- Adicionar `title` + `readOnlyHint` (read-only) ou `destructiveHint` (mutação) em toda tool registrada pelo MCP server.
- Auditar e garantir read/write split: nenhuma tool combina semântica safe (GET/HEAD) e unsafe (POST/PUT/PATCH/DELETE) num único handler.
- Validar que todo nome de tool ≤ 64 caracteres e remover ambiguidades.
- Adicionar middleware/guard no transport HTTP+SSE que valida o header `Origin` contra allowlist (`api.bfincont.com.br` + dev origins explícitos), bloqueando DNS rebinding.
- Revisar e endurecer descrições de tools: remover qualquer instrução que possa ser interpretada como prompt injection (override de system prompt, chamada de tools não solicitadas, fontes externas), remover linguagem promocional.
- Padronizar contrato de erro: input válido → resposta de sucesso; input inválido ou erro de domínio → erro JSON-RPC estruturado com mensagem acionável (campo, motivo, hint quando aplicável).
- Revisar escopos Auth0 declarados por tool e ajustar para least-privilege.
- Adicionar smoke validation via MCP Inspector documentado em `docs/mcp.md`.

Sem mudança de comportamento funcional das tools, apenas metadata, validações de transport e mensagens de erro.

## Capabilities

### New Capabilities
- `mcp-directory-compliance`: requisitos técnicos de compliance para submissão do servidor MCP a diretórios públicos (Anthropic Connectors Directory como alvo primário). Cobre annotations de tools, validação de Origin, hardening de descrições, contrato de erro padronizado e revisão de escopos OAuth.

### Modified Capabilities
- `mcp-server`: requisitos de tool registry passam a exigir `title` + annotations (`readOnlyHint`/`destructiveHint`) e descrições livres de prompt injection. Contrato de erro de `tools/call` passa a exigir formato estruturado com campo problemático identificado.

## Impact

- Código: `src/mcp/server.ts`, `src/mcp/tools/**`, `src/mcp/transport/**` (criar se não existir), `src/mcp/errors.ts` (novo ou ajustado).
- Configuração: variável de ambiente `MCP_ALLOWED_ORIGINS` (CSV) consumida pelo middleware de Origin.
- Auth0: revisão de scopes por tool em `src/mcp/scopes.ts` (ou equivalente). Pode requerer atualização do tenant Auth0.
- Documentação: `docs/mcp.md` ganha seção de annotations + validação Inspector + Origin allowlist.
- Testes: nova suíte vitest para Origin guard; expansão de `.hurl/e2e.hurl` cobrindo erros estruturados.
- Sem breaking change para clientes MCP existentes que já usam Origin permitido.

## Why

Para alcançar usuários ChatGPT além de Claude, o servidor MCP do bfin pode ser submetido também ao **OpenAI ChatGPT Apps SDK / MCP connector directory**. As exigências têm sobreposição grande com Anthropic (OAuth, HTTPS, anotações, demo account, privacy policy) mas adicionam particularidades: anotação `openWorldHint`, demo account explicitamente sem MFA (motivo #1 de rejeição), proibição estrita de coleta de payment/health/government ID/credentials, comércio limitado a bens físicos. Esta change captura os ajustes incrementais e o processo de submissão à OpenAI.

## What Changes

- Adicionar `openWorldHint` apropriado em todas as tools (true para tools cujo efeito atravessa o sistema controlado — externo, não-determinístico; false para tools puramente internas).
- Auditar descrição de tools verificando que nomes são verbos específicos, não genéricos (motivo de rejeição comum no review da OpenAI).
- Garantir que demo account criada em `add-mcp-directory-content` esteja realmente sem MFA e que não exista signup obrigatório (validar fluxo end-to-end como reviewer faria).
- Confirmar que bfin não viola content policy da OpenAI: nenhuma tool processa cartão, saúde, governmental ID, credentials de terceiros; nenhuma operação envolve gambling, drogas, armas, malware, scraping de API alheia.
- Preencher submission form do Apps SDK no platform.openai.com.
- Tracking de status separado (OpenAI manual review, sem prazo definido).

## Capabilities

### New Capabilities

### Modified Capabilities
- `mcp-directory-compliance`: estende anotações para incluir `openWorldHint`. Estende auditoria de descrição com regra de "verbo específico".
- `mcp-directory-submission`: estende processo para incluir submissão paralela à OpenAI, com tracking separado.

## Impact

- Código: `src/mcp/tools/__shared__/annotations.ts` ganha campo `openWorldHint`. Lint de descrição inclui regra de verbo específico.
- Doc: `docs/mcp-submission-package.md` ganha seção OpenAI; `docs/mcp-submission-status.md` ganha seção OpenAI separada.
- Sem mudanças no domínio.
- Pode ser submetido em paralelo com Anthropic ou após aprovação Anthropic — decisão capturada no design.

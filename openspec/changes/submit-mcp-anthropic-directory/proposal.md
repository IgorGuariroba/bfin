## Why

Após `add-mcp-directory-tech-compliance` e `add-mcp-directory-content` concluídos, falta o passo executivo: preencher o submission form da Anthropic, declarar metadados (tagline, casos de uso, allowed link URIs, data handling), passar pelo review da Anthropic e responder eventuais ajustes. Esta change captura o trabalho de submissão em si — não código novo, mas processo formal e checklist auditável.

## What Changes

- Selecionar o form correto: Remote MCP (servidor em `api.bfincont.com.br/mcp`) NÃO Desktop extension.
- Preparar dados do form: server name, URL, tagline, descrição, casos de uso, auth type (OAuth 2.0), transport (HTTP+SSE), read/write capabilities por tool.
- Listar e validar `allowed link URIs` (HTTPS origins do bfin + esquemas custom se houver).
- Marcar checklists de policy compliance, technical compliance, documentation, testing.
- Submeter, registrar protocolo, monitorar status; iterar em ajustes pedidos pelo reviewer.
- Após aprovação: publicar comunicado no repo, atualizar `docs/mcp.md`.

## Capabilities

### New Capabilities
- `mcp-directory-submission`: processo formal de submissão a diretórios externos do MCP — checklists pré-submissão, rastreamento de status, SLA de resposta a feedback.

### Modified Capabilities

## Impact

- Sem código novo no runtime.
- Adiciona artefato `docs/mcp-submission-status.md` rastreando status (Submitted, Under Review, Changes Requested, Approved).
- Pode requerer ajustes em ativos das changes 1 e 2 conforme feedback do reviewer.

## 1. Pré-submissão

- [ ] 1.1 Confirmar que `add-mcp-directory-tech-compliance` está implementado e arquivável
- [ ] 1.2 Confirmar que `add-mcp-directory-content` está implementado e arquivável
- [ ] 1.3 Rodar `npm run mcp:check-submission` e obter verde
- [ ] 1.4 Smoke `scripts/test-mcp-http.sh` contra produção
- [ ] 1.5 Smoke MCP Inspector contra `https://api.bfincont.com.br/mcp` simulando reviewer

## 2. Preenchimento do form

- [ ] 2.1 Localizar e abrir form Remote MCP no portal de submissão Anthropic
- [ ] 2.2 Preencher server name (`bfin`), URL (`https://api.bfincont.com.br/mcp`), tagline, descrição curta, descrição longa
- [ ] 2.3 Preencher casos de uso (3-5 entradas reais)
- [ ] 2.4 Selecionar auth type (`OAuth 2.0`), transport (`HTTP+SSE`), capabilities por tool (read/write)
- [ ] 2.5 Upload de logo SVG, favicon, screenshots
- [ ] 2.6 Declarar `allowed_link_uris`: `https://api.bfincont.com.br` (e demais sob bfincont.com.br)
- [ ] 2.7 Linkar privacy policy URL e doc pública URL
- [ ] 2.8 Marcar checklists: directory policy, technical (OAuth, HTTPS, Origin, annotations), documentation, testing
- [ ] 2.9 Preencher data & compliance (data handling, third parties, health data = NO, category)
- [ ] 2.10 Fornecer credenciais demo (referência a 1Password com link compartilhado)

## 3. Submissão e tracking

- [ ] 3.1 Submeter form
- [ ] 3.2 Criar `docs/mcp-submission-status.md` com primeira entrada `Submitted`
- [ ] 3.3 Anotar ID do ticket/email recebido
- [ ] 3.4 Configurar alerta no calendar para checagem de status semanal

## 4. Iteração com reviewer

- [ ] 4.1 Para cada feedback recebido, registrar entrada em `mcp-submission-status.md`
- [ ] 4.2 Triagem: ajuste simples (resposta direta) ou complexo (gera change OpenSpec dedicada)
- [ ] 4.3 Aplicar correções e responder dentro de 5 dias úteis
- [ ] 4.4 Reexecutar `npm run mcp:check-submission` antes de cada re-submissão

## 5. Pós-aprovação

- [ ] 5.1 Registrar `Approved` em `mcp-submission-status.md`
- [ ] 5.2 Atualizar `README.md` com badge/link da listagem
- [ ] 5.3 Adicionar seção "Status no Anthropic Directory" em `docs/mcp.md`
- [ ] 5.4 Comunicar internamente (commit + memory file)

## 1. Pré-requisitos

- [ ] 1.1 Confirmar `add-mcp-directory-tech-compliance` arquivado
- [ ] 1.2 Confirmar `add-mcp-directory-content` arquivado
- [ ] 1.3 Decidir: submeter em paralelo com Anthropic ou após aprovação Anthropic (preferido)

## 2. Extensão de annotations

- [ ] 2.1 Adicionar campo `openWorldHint` ao helper `withAnnotations` em `src/mcp/tools/__shared__/annotations.ts`
- [ ] 2.2 Default `openWorldHint: false`; permitir override por tool via parâmetro do helper
- [ ] 2.3 Atualizar guard do registry para falhar boot se `openWorldHint` ausente
- [ ] 2.4 Auditar tools atuais: marcar `false` em todas as internas
- [ ] 2.5 Atualizar testes vitest do registry

## 3. Lint de verbo específico

- [ ] 3.1 Criar `src/mcp/tools/__lint__/action-verbs.ts` com allowlist
- [ ] 3.2 Estender `scripts/audit-mcp-descriptions.ts` cobrindo regra de verbo inicial
- [ ] 3.3 Revisar descrições atuais e ajustar as não conformes
- [ ] 3.4 Rodar lint até verde

## 4. Verificação Auth0 da demo account

- [ ] 4.1 Implementar checagem em `scripts/check-submission.ts` que consulta Auth0 Management API e valida MFA disabled na conta demo
- [ ] 4.2 Adicionar credencial Auth0 management em secret manager (read-only para usuário demo)
- [ ] 4.3 Adicionar flag `--target=openai` ao script para validações específicas
- [ ] 4.4 Documentar configuração Auth0 em `docs/mcp.md`

## 5. Verificação de categorias proibidas

- [ ] 5.1 Auditar schemas de input de cada tool em busca de campos `cardNumber`, `cvv`, `ssn`, `passport`, `healthRecord`, `password`, `accessToken`
- [ ] 5.2 Adicionar guard estático em `scripts/check-submission.ts` que falha se algum schema contém esses campos
- [ ] 5.3 Documentar política em `docs/privacy.md` (já redigida em change anterior — atualizar se necessário)

## 6. Submissão OpenAI

- [ ] 6.1 Verificar acesso e elegibilidade em `platform.openai.com` (verified developer)
- [ ] 6.2 Preencher form do Apps SDK: name, logo, descrição, company URL, privacy policy URL, MCP URL
- [ ] 6.3 Tool information: lista com `name`, `description`, anotações
- [ ] 6.4 Upload screenshots (reaproveitar do branding pack)
- [ ] 6.5 Fornecer 5+ test prompts com respostas esperadas
- [ ] 6.6 Localização en-US
- [ ] 6.7 Demo credentials (sem MFA, com sample data)
- [ ] 6.8 Categoria (provisoriamente "Productivity" ou "Finance")
- [ ] 6.9 Submeter

## 7. Tracking e iteração

- [ ] 7.1 Adicionar seção `## OpenAI` em `docs/mcp-submission-status.md` com primeira entrada `Submitted`
- [ ] 7.2 Anotar ID do ticket
- [ ] 7.3 Para cada feedback OpenAI, registrar entrada e responder em até 5 dias úteis
- [ ] 7.4 Reusar `mcp:check-submission --target=openai` antes de cada re-submissão

## 8. Pós-aprovação OpenAI

- [ ] 8.1 Registrar `Approved` na seção OpenAI
- [ ] 8.2 Atualizar `README.md` com badge OpenAI
- [ ] 8.3 Atualizar `docs/mcp.md` com link da listagem OpenAI

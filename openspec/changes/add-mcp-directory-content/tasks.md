## 1. Política de privacidade

- [ ] 1.1 Redigir `docs/privacy.md` cobrindo dados coletados, não coletados, finalidade, retenção, subprocessadores, LGPD, contato
- [ ] 1.2 Configurar Caddy para servir `https://api.bfincont.com.br/privacy` apontando para o markdown renderizado (ou redirect ao GitHub raw)
- [ ] 1.3 Adicionar rota `/privacy` no Fastify (alternativa) que serve markdown convertido em HTML
- [ ] 1.4 Smoke `curl -I https://api.bfincont.com.br/privacy` → 200
- [ ] 1.5 Linkar política em `README.md` e `docs/mcp.md`

## 2. Documentação pública

- [ ] 2.1 Confirmar visibilidade do repo bfin (`gh repo view`); se privado, criar `bfin-public-docs` com cópia
- [ ] 2.2 Expandir `docs/mcp.md` com: visão geral, MCP endpoint URL, fluxo OAuth Auth0, escopos disponíveis
- [ ] 2.3 Adicionar tabela `tools` com `name | title | description | requiredScope` derivada de `src/mcp/tools/**`
- [ ] 2.4 Adicionar seção "Troubleshooting" cobrindo cada `code` do contrato de erro
- [ ] 2.5 Adicionar lint script `scripts/check-mcp-doc-sync.ts` que falha se a tabela diverge do código real
- [ ] 2.6 Plugar lint no pre-commit hook em `.githooks/pre-commit`

## 3. Conta demo

- [ ] 3.1 Definir constante `DEMO_ACCOUNT_ID` em `src/config.ts`
- [ ] 3.2 Provisionar usuário demo no Auth0 (`mcp-review@bfincont.com.br`) sem MFA, com escopos completos read+write+delete
- [ ] 3.3 Armazenar senha em secret manager (1Password / Bitwarden); adicionar referência em `docs/mcp-submission-package.md`
- [ ] 3.4 Implementar `scripts/seed-demo-account.ts` com seed determinístico (2 accounts, 30 transactions, 1 debt 12x, 1 goal, 1 projection)
- [ ] 3.5 Implementar `scripts/reset-demo-account.ts` que apaga writes na conta demo e re-roda seed
- [ ] 3.6 Configurar cron job no host (systemd timer) para rodar reset 03:00 BRT
- [ ] 3.7 Adicionar guard em services que rejeita vínculo de usuário real à `DEMO_ACCOUNT_ID`
- [ ] 3.8 Documentar janela de reset em `docs/mcp.md`

## 4. Branding pack

- [ ] 4.1 Criar `docs/branding/logo.svg` e `logo-dark.svg` (transparente, vetorial)
- [ ] 4.2 Gerar `favicon.ico` e `favicon-32.png` a partir do logo
- [ ] 4.3 Capturar 3-5 screenshots PNG 1280×800 do MCP em uso (Claude Desktop ou Inspector)
- [ ] 4.4 Redigir `docs/branding/tagline.txt` (≤80 chars)
- [ ] 4.5 Redigir `docs/branding/desc-short.txt` (≤140 chars) e `desc-long.md` (≤2000 chars)
- [ ] 4.6 Validar limites com script `scripts/check-branding.ts`

## 5. Submission package

- [ ] 5.1 Criar `docs/mcp-submission-package.md` com checklist completo (URL privacy, URL doc, credenciais demo, branding paths, transport, allowed URIs)
- [ ] 5.2 Implementar `scripts/check-submission.ts` validando existência de cada item
- [ ] 5.3 Adicionar `npm run mcp:check-submission` em `package.json`
- [ ] 5.4 Rodar e gerar relatório verde antes de submeter

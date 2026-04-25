## Why

A submissão do servidor MCP do bfin ao Anthropic Connectors Directory exige material não-técnico: política de privacidade pública, documentação pública (blog post ou help-center), conta demo populada para o time de revisão da Anthropic, e ativos de branding (logo, favicon, screenshots, tagline). Sem esse pacote a submissão é rejeitada antes de chegar à revisão técnica.

## What Changes

- Publicar política de privacidade pública em URL estável descrevendo coleta mínima, uso, retenção, third parties (Auth0, GHCR), categorias proibidas que NÃO são processadas (cartão, saúde, doc oficial), direitos do titular e contato.
- Publicar documentação pública do MCP (README em GitHub público OU página em help-center): visão geral, casos de uso, fluxo de auth (OAuth Auth0), lista de tools com descrição, troubleshooting básico.
- Provisionar conta demo `mcp-review@bfincont.com.br` (ou similar) populada com dataset sintético: 2 contas, ~30 transações distribuídas, 1 dívida com installments, 1 meta, projeção fechada. Sem MFA, sem necessidade de signup adicional.
- Criar pacote de branding: logo SVG (transparente), favicon, 3-5 screenshots em alta resolução exibindo tools em ação, tagline curta, descrição curta (≤140 chars) e descrição longa.
- Adicionar `manifest.json` se aplicável (caso decida-se também publicar como desktop extension via MCPB) — fica como decisão a ser tomada no design.

## Capabilities

### New Capabilities
- `mcp-directory-content`: pacote de conteúdo público obrigatório para submissão do MCP a diretórios externos: política de privacidade, documentação pública, conta demo, branding assets.

### Modified Capabilities

## Impact

- Repositório: novo arquivo `docs/privacy.md` ou rota `/privacy` na API; expansão de `docs/mcp.md`; pasta `docs/branding/` com SVG e screenshots.
- Infra: rota pública para política (servida via Caddy ou GitHub Pages); subdomínio ou path adicional se necessário.
- Auth0: usuário demo com escopos completos read-only; senha rotacionada e armazenada em secret manager.
- Banco: seed script `scripts/seed-demo-account.ts` para popular conta demo.
- Sem mudança no domínio/services.

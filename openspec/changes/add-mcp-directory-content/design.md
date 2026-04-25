## Context

bfin é app de finanças pessoais com domínios (accounts, transactions, debts, goals). MCP server expõe tools sobre OAuth Auth0. Para submeter ao Anthropic Connectors Directory faltam quatro entregáveis públicos: privacy policy, doc, demo account, branding. Esta change concentra produção e publicação desses ativos.

Stakeholders: usuário (igor) como dono e único editor; time de revisão Anthropic como consumidor; futuros usuários do MCP (B2C) como audiência da doc.

## Goals / Non-Goals

**Goals:**
- Privacy policy publicada em URL HTTPS estável.
- Doc pública acessível por anyone, em PT/EN bilíngue ou EN-only inicialmente.
- Conta demo funcional, sem MFA, com dataset realista mas sintético.
- Branding pack (SVG + PNG screenshots + tagline + descrições).

**Non-Goals:**
- Onboarding público completo do produto (out of scope; foca diretório).
- Marketing/SEO da landing page.
- I18n profissional (drafts em PT-BR aceitos, traduzir EN se exigido).
- Migrar dados reais para conta demo.

## Decisions

### Decision: Privacy policy hospedada como `docs/privacy.md` + rota Caddy
Servir `https://api.bfincont.com.br/privacy` apontando para arquivo estático ou redirect ao GitHub. URL precisa ser estável e versionada (`/privacy/v1`).

**Alternativa considerada:** GitHub Pages standalone. Rejeitada — adiciona DNS/cert separado quando Caddy já cobre o domínio.

### Decision: Doc pública como `docs/mcp.md` no repo público + página Caddy
Repo bfin é público (precisa confirmar; se privado, criar repo `bfin-public-docs` com cópia da doc). Anthropic aceita "blog post or help-center article" — markdown público em GitHub satisfaz.

**Alternativa considerada:** Notion. Rejeitada — depende de auth pública estável e formatação fora do repo.

### Decision: Conta demo isolada por feature flag `DEMO_ACCOUNT_ID`
Conta demo recebe ID conhecido. Tools operam normalmente, mas writes na conta demo são reset diariamente via cron job (`scripts/reset-demo-account.ts`). Garante que a conta sempre apresenta dataset previsível para o reviewer.

**Alternativa considerada:** demo read-only. Rejeitada — Anthropic precisa testar tools destrutivas também.

### Decision: Dataset sintético com geração determinística
Seed `scripts/seed-demo-account.ts` recebe seed fixo, gera dataset reproduzível: 2 accounts, 30 transactions ao longo de 90 dias, 1 debt 12x, 1 goal `emergency-reserve`, projection cacheada.

### Decision: Branding pack em `docs/branding/`
- `logo.svg` + `logo-dark.svg` (transparente)
- `favicon.ico` + `favicon-32.png`
- `screenshots/01-tools-list.png` ... `05-error-flow.png` (1280×800)
- `tagline.txt` (≤80 chars), `desc-short.txt` (≤140 chars), `desc-long.md`

## Risks / Trade-offs

- **Risco:** Privacy policy precisa cobrir LGPD (Brasil) + diretório Anthropic (US). → Mitigação: usar template legal-friendly, revisar com terceira parte se possível.
- **Risco:** Conta demo é vetor de abuse se vazar credencial. → Mitigação: senha gerada com 32 bytes random, rotacionada mensalmente, escopos limitados, rate-limit agressivo, DB reset diário.
- **Risco:** Reset diário da conta demo apaga teste do reviewer em curso. → Mitigação: documentar janela de reset (e.g., 03:00 BRT) no submission form.
- **Risco:** Repo bfin pode ser privado; doc pública precisa de outro lar. → Mitigação: antes de publicar, confirmar visibilidade no GitHub e fork doc para repo público se necessário.

## Open Questions

- Repo bfin é público ou privado? (Verificar `gh repo view`).
- Existe ToS/PP corporativo já redigido reaproveitável?
- Idioma primário da doc: EN (alvo Anthropic) ou PT-BR (audiência local)?
- Anthropic aceita conta demo compartilhada ou exige uma instância dedicada do MCP?

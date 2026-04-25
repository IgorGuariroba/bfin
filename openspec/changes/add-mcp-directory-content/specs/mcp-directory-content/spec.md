## ADDED Requirements

### Requirement: Política de privacidade pública
O projeto SHALL publicar uma política de privacidade acessível sem autenticação em URL HTTPS estável (`https://api.bfincont.com.br/privacy` ou subdomínio equivalente). A política SHALL cobrir: categorias de dados coletados (mínimas: e-mail, ID Auth0, dados financeiros do próprio usuário); categorias explicitamente NÃO coletadas (cartão, dados de saúde, documento oficial, credenciais); finalidades de uso; retenção e exclusão; subprocessadores (Auth0, GHCR); direitos do titular (LGPD); contato.

#### Scenario: URL pública responde 200
- **WHEN** uma requisição GET sem credenciais é feita à URL da política
- **THEN** o servidor responde HTTP 200 com Content-Type `text/html` ou `text/markdown` e o conteúdo da política

#### Scenario: Política linkada na submissão
- **WHEN** o submission form da Anthropic é preenchido
- **THEN** o campo de privacy policy aponta para a URL pública e o reviewer consegue abrir sem login

#### Scenario: Atualização da política versiona conteúdo
- **WHEN** o conteúdo da política é alterado
- **THEN** o histórico fica versionado em git (`docs/privacy.md`) e a URL serve o conteúdo atual sem quebrar links existentes

### Requirement: Documentação pública do MCP server
O projeto SHALL publicar documentação acessível sem autenticação descrevendo o servidor MCP. A doc SHALL cobrir: visão geral do produto; URL do MCP endpoint; fluxo de auth (OAuth 2.0 via Auth0, escopos disponíveis); lista de tools com `name`, `title`, descrição factual e `requiredScope`; exemplos de uso; troubleshooting de erros estruturados (`INVALID_INPUT`, `NOT_FOUND`, `FORBIDDEN`, `BUSINESS_RULE`, `INTERNAL`); contato/suporte.

#### Scenario: Doc acessível via GitHub público
- **WHEN** um reviewer abre a URL canônica da doc
- **THEN** o conteúdo é renderizado sem login

#### Scenario: Lista de tools sincronizada
- **WHEN** uma tool é adicionada ou removida em `src/mcp/tools/**`
- **THEN** a doc é atualizada na mesma PR (lint check do CI verifica diff)

### Requirement: Conta demo populada e isolada
O projeto SHALL provisionar uma conta demo com credenciais entregues à Anthropic via submission form, sem MFA e sem necessidade de cadastro adicional. A conta demo SHALL ser populada via seed determinístico contendo no mínimo: 2 accounts, 30 transactions distribuídas em 90 dias, 1 debt com 12 installments parciais, 1 goal `emergency-reserve` com aporte parcial, 1 projection cacheada. Writes na conta demo SHALL ser resetados em janela diária documentada, garantindo dataset previsível.

#### Scenario: Login da conta demo sem MFA
- **WHEN** o reviewer usa as credenciais fornecidas
- **THEN** o login conclui sem solicitar segundo fator

#### Scenario: Dataset reproduzível
- **WHEN** o seed `scripts/seed-demo-account.ts` é executado
- **THEN** o estado pós-seed é idêntico ao estado documentado na seção "Demo dataset" de `docs/mcp.md`

#### Scenario: Reset diário restaura dataset
- **WHEN** o cron `reset-demo-account` executa
- **THEN** a conta demo retorna ao dataset baseline e logs registram o reset

#### Scenario: Conta demo não é usada por usuários reais
- **WHEN** um operador tenta vincular usuário real à conta demo
- **THEN** o sistema rejeita com erro citando `DEMO_ACCOUNT_ID`

### Requirement: Pacote de branding completo
O repositório SHALL armazenar em `docs/branding/` ativos prontos para submissão: `logo.svg` (transparente), `logo-dark.svg`, `favicon.ico`, `favicon-32.png`, ao menos 3 screenshots PNG em 1280×800 ilustrando uso do MCP, `tagline.txt` (≤80 chars), `desc-short.txt` (≤140 chars), `desc-long.md` (≤2000 chars).

#### Scenario: Pacote completo no repositório
- **WHEN** o submitter empacota a submissão
- **THEN** todos os arquivos listados existem em `docs/branding/` e os screenshots renderizam tools reais (não mockups)

#### Scenario: Logo em fundo escuro/claro
- **WHEN** o diretório exibe o logo em fundo claro ou escuro
- **THEN** ambos os SVGs (claro e dark) preservam legibilidade

#### Scenario: Tagline e descrições dentro do limite
- **WHEN** os arquivos são lidos
- **THEN** `tagline.txt` ≤ 80 chars, `desc-short.txt` ≤ 140 chars, `desc-long.md` ≤ 2000 chars

### Requirement: Submission package consolidado
O repositório SHALL manter um documento `docs/mcp-submission-package.md` listando todos os entregáveis exigidos pela Anthropic Directory: URL da política, URL da doc, credenciais da conta demo (referência a secret manager, NÃO em plaintext), caminhos dos branding assets, transport protocol, allowed link URIs, status de cada checklist da submission form.

#### Scenario: Package completo antes da submissão
- **WHEN** o operador roda `npm run mcp:check-submission`
- **THEN** o script valida existência de cada item do package e falha se faltar

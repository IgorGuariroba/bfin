## ADDED Requirements

### Requirement: Submissão paralela ao OpenAI ChatGPT Apps SDK
O processo de submissão SHALL suportar uma submissão adicional, independente da Anthropic, ao **OpenAI ChatGPT Apps SDK** via portal `platform.openai.com`. A submissão OpenAI SHALL ser tratada como track separado, com tracking próprio.

#### Scenario: Tracking separado por diretório
- **WHEN** uma transição de status acontece na submissão OpenAI
- **THEN** o evento é registrado na seção `## OpenAI` de `docs/mcp-submission-status.md`, sem misturar com a seção `## Anthropic`

#### Scenario: Submissão OpenAI usa o mesmo pacote
- **WHEN** o operador inicia a submissão à OpenAI
- **THEN** os mesmos artefatos (privacy policy URL, doc pública, demo account, branding) são reutilizados sem precisar duplicar

### Requirement: Pré-submissão OpenAI específica
Antes de submeter ao OpenAI, o operador SHALL validar adicionalmente: (a) `openWorldHint` declarado em todas as tools; (b) descrições passam lint de verbo específico; (c) demo account confirmadamente sem MFA via check Auth0; (d) categorias de dados proibidas pela OpenAI (payment card, health, government ID, credentials) NÃO são processadas por nenhuma tool.

#### Scenario: Check OpenAI verde
- **WHEN** o operador roda `npm run mcp:check-submission -- --target=openai`
- **THEN** o exit code é 0 e cada item OpenAI-específico recebe ✔

#### Scenario: Categoria proibida detectada
- **WHEN** uma tool processa campo `cardNumber` ou `ssn`
- **THEN** o check falha apontando a tool e o campo violador

### Requirement: Form Apps SDK preenchido com escopo OpenAI
A submissão à OpenAI SHALL preencher: app name, logo, descrição, company URL, privacy policy URL, MCP URL, tool information, screenshots, test prompts e respostas, localização (en-US no mínimo), demo credentials sem MFA, categoria.

#### Scenario: Test prompts representativos
- **WHEN** o form solicita test prompts
- **THEN** o operador fornece pelo menos 5 prompts cobrindo: leitura (`list transactions`), criação, atualização, projeção, daily-limit, com respostas esperadas

## ADDED Requirements

### Requirement: Anotação openWorldHint em tools
Toda tool registrada SHALL declarar `openWorldHint: boolean`. O valor SHALL ser `true` quando o efeito da tool atravessa fronteira do bfin para serviço externo cujo resultado depende de estado fora do controle do bfin (ex.: chamadas a APIs de terceiros sem cache local determinístico). O valor SHALL ser `false` para tools cujo efeito está totalmente contido no domínio bfin (DB próprio, services internos).

#### Scenario: Tool interna recebe openWorldHint false
- **WHEN** `transactions_list` é registrada
- **THEN** sua definição inclui `openWorldHint: false`

#### Scenario: Tool externa recebe openWorldHint true
- **WHEN** o futuro `bank-sync_pull` (chamada a Open Finance) é registrado
- **THEN** sua definição inclui `openWorldHint: true`

#### Scenario: Ausência de openWorldHint falha boot
- **WHEN** o desenvolvedor registra uma tool sem `openWorldHint`
- **THEN** o servidor SHALL falhar no startup citando a tool faltante

### Requirement: Descrição com verbo específico de ação
Toda `description` de tool SHALL começar por verbo de ação específico (allowlist mantida em `src/mcp/tools/__lint__/action-verbs.ts`, contendo no mínimo: `List`, `Get`, `Create`, `Update`, `Delete`, `Set`, `Pay`, `Add`, `Remove`, `Project`, `Verify`, `Resolve`). Descrições começando com substantivo, gerúndio ou frase genérica ("Tool for ...", "Manages ...", "Handles ...") SHALL ser rejeitadas pelo lint.

#### Scenario: Descrição com verbo aceita
- **WHEN** uma tool tem description `"List financial transactions for an account"`
- **THEN** o lint passa

#### Scenario: Descrição genérica rejeitada
- **WHEN** uma tool tem description `"Tool for handling transactions"`
- **THEN** o lint falha apontando o início inválido

### Requirement: Demo account sem MFA validado por automação
O script `npm run mcp:check-submission` SHALL incluir verificação que consulta a configuração da conta demo no Auth0 e falha se MFA estiver habilitado para o usuário demo, ou se houver any required factor além de senha.

#### Scenario: MFA desativado passa
- **WHEN** o operador roda `npm run mcp:check-submission`
- **THEN** a verificação Auth0 retorna que o usuário demo não tem MFA e o check é verde

#### Scenario: MFA ativado bloqueia
- **WHEN** algum factor (TOTP, WebAuthn, SMS) está habilitado para o usuário demo
- **THEN** o check falha com mensagem citando o factor a remover

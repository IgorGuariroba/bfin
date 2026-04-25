## ADDED Requirements

### Requirement: Pré-submissão validada
Antes de qualquer submissão a um diretório externo, o operador SHALL executar `npm run mcp:check-submission` e obter saída verde, evidenciando que: política de privacidade está pública (HTTP 200 sem auth); doc pública existe; conta demo está ativa e seedada; pacote de branding está completo; testes técnicos (`test`, `test:hurl`, `mcp:audit-descriptions`, `mcp:audit-names`) passam.

#### Scenario: Pré-submissão completa
- **WHEN** o operador roda `npm run mcp:check-submission`
- **THEN** o exit code é 0 e cada item do package recebe ✔ no relatório

#### Scenario: Pré-submissão falha bloqueia envio
- **WHEN** algum item do package está ausente ou inválido
- **THEN** o exit code é diferente de 0 e o relatório lista os itens em vermelho

### Requirement: Form correto por tipo de servidor
Para o MCP server remoto do bfin, o operador SHALL usar o **Remote MCP / MCP Apps directory submission form** (não o Desktop extension form). O link canônico do form SHALL estar registrado em `docs/mcp-submission-package.md`.

#### Scenario: Form remoto é o utilizado
- **WHEN** o operador inicia a submissão
- **THEN** o form aberto corresponde ao Remote MCP, e os campos preenchidos refletem o servidor HTTP+SSE em `https://api.bfincont.com.br/mcp`

### Requirement: Allowed link URIs declarados e validados
A submissão SHALL declarar todos os HTTPS origins e custom URI schemes que o conector pode abrir via `ui/open-link`. Cada origin SHALL ser de domínio comprovadamente owned pela mesma organização que submete o conector.

#### Scenario: Origins do bfin
- **WHEN** o form solicita allowed link URIs
- **THEN** o operador declara `https://api.bfincont.com.br` e demais origins HTTPS sob `bfincont.com.br`, omitindo origins de terceiros

### Requirement: Rastreamento de status da submissão
O repositório SHALL manter `docs/mcp-submission-status.md` registrando, em ordem cronológica: data da submissão, ID do ticket/email recebido da Anthropic, transições de status (Submitted, Under Review, Changes Requested, Approved, Rejected, Withdrawn), feedback recebido e ações tomadas.

#### Scenario: Atualização imediata após cada evento
- **WHEN** a Anthropic envia feedback ou muda status
- **THEN** uma linha nova é adicionada em `docs/mcp-submission-status.md` na mesma sessão de trabalho, com a data e o conteúdo do evento

#### Scenario: Histórico preservado
- **WHEN** o status final é Approved ou Rejected
- **THEN** o documento mantém todas as transições anteriores intactas (append-only)

### Requirement: SLA interno para changes requested
Quando a Anthropic solicitar ajustes ("Changes Requested"), o operador SHALL produzir resposta ou PR de ajuste em até 5 dias úteis. Casos cujo ajuste exija nova feature ou re-revisão de segurança SHALL gerar change OpenSpec dedicada.

#### Scenario: Ajuste simples dentro do SLA
- **WHEN** o reviewer pede correção menor (ex.: descrição de uma tool)
- **THEN** o PR de ajuste é aberto em até 5 dias úteis e a entrada em `mcp-submission-status.md` registra a ação

#### Scenario: Ajuste complexo gera change separada
- **WHEN** o reviewer exige re-design de uma tool destrutiva
- **THEN** o operador cria nova change OpenSpec descrevendo a mudança e o status fica como "Changes Requested - blocked on <change-name>"

### Requirement: Comunicação pós-aprovação
Após aprovação, o operador SHALL atualizar `README.md` e `docs/mcp.md` com badge/seção informando que o conector está listado, link para a página no diretório, e data da aprovação.

#### Scenario: Doc atualizada
- **WHEN** a Anthropic confirma listagem
- **THEN** README e docs/mcp.md exibem o link para a entrada no diretório

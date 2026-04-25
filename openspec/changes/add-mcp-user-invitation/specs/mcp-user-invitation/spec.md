## ADDED Requirements

### Requirement: Entidade convite_usuario no banco de dados
O sistema SHALL manter a tabela `convites_usuario` com os campos: `id` (UUID PK), `email` (VARCHAR NOT NULL), `criado_por` (UUID FK → `usuarios.id`), `criado_em` (TIMESTAMP), `expira_em` (TIMESTAMP NOT NULL), `status` (ENUM `pendente`/`aceito`/`expirado`/`revogado` DEFAULT `pendente`), `token_uso_unico` (UUID UNIQUE NOT NULL), `usuario_id` (UUID FK → `usuarios.id` NULLABLE; populado quando convite é aceito).

#### Scenario: Migration cria tabela
- **WHEN** `drizzle-kit migrate` é executado
- **THEN** tabela `convites_usuario` existe com todas as colunas, FK para `usuarios.id`, índice em `email` e UNIQUE em `token_uso_unico`

#### Scenario: Email pode ter múltiplos convites históricos
- **WHEN** convite anterior está `aceito`/`expirado`/`revogado` e admin emite novo convite para mesmo email
- **THEN** sistema aceita inserção (não há UNIQUE em email)

#### Scenario: Email não pode ter dois convites pendentes simultaneamente
- **WHEN** já existe convite `pendente` para email X e admin tenta criar outro para X
- **THEN** sistema rejeita com `code: "DUPLICATE_INVITATION"` e devolve o convite existente

### Requirement: Emissão de convite via endpoint admin
O sistema SHALL expor `POST /admin/users/invitations` (admin-only) que recebe `{ email: string, expiraEmDias?: number }` e cria registro `convites_usuario` com `status: "pendente"`. Resposta SHALL retornar `{ id, email, token, expiraEm, criadoPor, criadoEm }`. Endpoint SHALL exigir token Google OIDC válido com `is_admin: true`.

#### Scenario: Admin cria convite com email novo
- **WHEN** admin envia `POST /admin/users/invitations` com `{ "email": "alice@example.com" }` e token de admin válido
- **THEN** sistema cria registro `pendente`, retorna `201` com `{ id, email, token, expiraEm: now+7d }`

#### Scenario: Não-admin chama endpoint
- **WHEN** usuário sem `is_admin: true` envia `POST /admin/users/invitations`
- **THEN** sistema retorna `403 Forbidden` com `code: "ADMIN_REQUIRED"`

#### Scenario: TTL customizado dentro do limite
- **WHEN** admin envia `{ "email": "x@y.com", "expiraEmDias": 30 }`
- **THEN** convite criado com `expira_em = now() + 30 days`

#### Scenario: TTL acima do limite
- **WHEN** admin envia `expiraEmDias > 90`
- **THEN** sistema retorna `400` com `code: "INVALID_INPUT"`, `field: "expiraEmDias"`

### Requirement: Listagem de convites via endpoint admin
O sistema SHALL expor `GET /admin/users/invitations` (admin-only) com query params opcionais `status` (CSV de `pendente,aceito,expirado,revogado`) e `email` (busca exact match). Resposta SHALL retornar `[{ id, email, status, criadoPor, criadoEm, expiraEm, usuarioId, token }]` ordenado por `criadoEm DESC`.

#### Scenario: Admin lista todos
- **WHEN** admin envia `GET /admin/users/invitations`
- **THEN** sistema retorna array com todos convites independente de status

#### Scenario: Filtro por status pendente
- **WHEN** admin envia `GET /admin/users/invitations?status=pendente`
- **THEN** sistema retorna apenas convites com `status: "pendente"` e `expira_em > now()`

#### Scenario: Convite vencido aparece como expirado
- **WHEN** registro tem `status: "pendente"` mas `expira_em < now()` e admin lista
- **THEN** sistema retorna o registro com `status: "expirado"` (computado on-the-fly)

### Requirement: Revogação de convite via endpoint admin
O sistema SHALL expor `DELETE /admin/users/invitations/:id` (admin-only) que muda `status` para `revogado`. Convites já `aceito` ou `revogado` SHALL retornar `409 Conflict`.

#### Scenario: Revoga convite pendente
- **WHEN** admin envia `DELETE /admin/users/invitations/<id>` para convite pendente
- **THEN** sistema atualiza `status: "revogado"` e retorna `204`

#### Scenario: Tenta revogar convite aceito
- **WHEN** admin envia `DELETE` para convite com `status: "aceito"`
- **THEN** sistema retorna `409` com `code: "INVALID_TRANSITION"`

#### Scenario: Convite não existe
- **WHEN** admin envia `DELETE` com id inexistente
- **THEN** sistema retorna `404` com `code: "NOT_FOUND"`

### Requirement: Provisionamento MCP exige convite pendente
O fluxo de provisionamento de usuário no MCP HTTP transport (`src/mcp/oauth/provisioning.ts`) SHALL, quando o `sub` do token Auth0 não existe em `usuarios`, consultar `convites_usuario` por email do claim. Convite SHALL satisfazer: `status = "pendente"` E `expira_em > now()` E email match (lowercase + trim em ambas pontas). Convite válido SHALL autorizar criação do `Usuario` com `id_provedor = sub`. Convite ausente, expirado ou revogado SHALL rejeitar com `403 Forbidden` e payload estruturado.

#### Scenario: Login com convite válido provisiona usuário
- **WHEN** Auth0 entrega token com `sub: "auth0|123"` (novo) e `email: "alice@example.com"`, e existe convite `pendente` não-expirado para `alice@example.com`
- **THEN** sistema cria registro `Usuario`, atualiza convite para `status: "aceito"` e `usuario_id = <novo user>`, e prossegue com a request

#### Scenario: Login sem convite
- **WHEN** Auth0 entrega token com `sub` novo e email sem convite pendente
- **THEN** sistema retorna `403 Forbidden` com payload `{ code: "INVITATION_REQUIRED", message, hint }` citando o endpoint admin

#### Scenario: Login com convite expirado
- **WHEN** existe convite com `expira_em < now()` para o email
- **THEN** sistema rejeita com `code: "INVITATION_REQUIRED"` e marca convite como `expirado` na resposta de listagem

#### Scenario: Login com convite revogado
- **WHEN** existe convite `revogado` para o email
- **THEN** sistema rejeita com `code: "INVITATION_REQUIRED"`

#### Scenario: Email normalizado (case + trim)
- **WHEN** convite tem `email: "alice@example.com"` e token claim tem `email: " Alice@Example.com "`
- **THEN** sistema reconhece match e provisiona

#### Scenario: Race condition entre dois logins paralelos
- **WHEN** dois requests do mesmo email novo chegam simultaneamente e existe convite `pendente`
- **THEN** apenas um cria `Usuario` e consome o convite; o outro detecta o user já criado por `email` e prossegue sem criar duplicata nem rejeitar

#### Scenario: Email já existe em `usuarios` via outro provider (cross-provider link)
- **WHEN** token Auth0 traz `sub` novo (ex.: `google-oauth2|123`) e `email` que já existe em `usuarios` com `id_provedor` diferente (ex.: criado via Google OIDC main API), E existe convite `pendente` válido para esse email
- **THEN** sistema SHALL atualizar `id_provedor` da row existente para o `sub` do Auth0 (vincula identidade), marcar convite como `aceito` apontando para a row existente, e prosseguir — sem INSERT nem violação de UNIQUE

#### Scenario: Email já existe sem convite válido
- **WHEN** token Auth0 traz `sub` novo e `email` já existente em `usuarios`, mas não há convite `pendente` válido
- **THEN** sistema SHALL rejeitar com `code: "INVITATION_REQUIRED"` (não vincula identidade sem autorização explícita do admin)

### Requirement: Erro estruturado INVITATION_REQUIRED
O servidor SHALL emitir resposta HTTP 403 com body `{ "error": "forbidden", "error_description": "INVITATION_REQUIRED: ...", "code": "INVITATION_REQUIRED", "hint": "Solicite ao admin um convite via POST /admin/users/invitations" }` quando o gate de convite rejeita o login.

#### Scenario: Cliente recebe erro acionável
- **WHEN** request MCP é rejeitada por falta de convite
- **THEN** body inclui `code: "INVITATION_REQUIRED"` e `hint` apontando para o fluxo admin

### Requirement: Deprecation gradual de MCP_PROVISIONING_ALLOWED_EMAILS
O sistema SHALL aceitar a env var `MCP_PROVISIONING_ALLOWED_EMAILS` por 1 release adicional como fallback secundário (consultada apenas se não houver convite). Boot SHALL emitir log WARN se a var estiver presente, citando substituição pelo endpoint admin. Próximo release remove o suporte e a var é rejeitada se presente.

#### Scenario: Var presente em release de transição
- **WHEN** processo inicia com `MCP_PROVISIONING_ALLOWED_EMAILS=foo@bar.com`
- **THEN** boot emite WARN log uma vez, sistema usa convite primeiro e var como fallback

#### Scenario: Var presente em release pós-deprecation
- **WHEN** processo inicia com a var em release que removeu o suporte
- **THEN** boot falha com erro descritivo apontando para a documentação de migração

### Requirement: Documentação do fluxo de convite em docs/mcp.md
O repositório SHALL documentar em `docs/mcp.md` o fluxo de convite: como admin emite, como user recebe (informalmente, fora do sistema), como o gate aplica no provisionamento, exemplos curl e checklist Auth0.

#### Scenario: Operador segue documentação para onboardar user
- **WHEN** admin lê `docs/mcp.md` seção "Onboarding via convite"
- **THEN** consegue executar todos os passos sem ambiguidade

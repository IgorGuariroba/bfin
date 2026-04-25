## Why

Hoje o provisionamento de usuários MCP depende da env var `MCP_PROVISIONING_ALLOWED_EMAILS` (lista CSV/regex em `src/mcp/oauth/provisioning.ts`). Em produção isso obriga deploy a cada novo usuário e mistura controle de acesso com configuração de infra. O fluxo de convite move a decisão para dados — admin emite convite via API, sistema cria registro pendente, primeiro login Auth0 com email matching ativa o usuário sem reload de config.

## What Changes

- Nova tabela `convites_usuario` com `email`, `criado_por`, `criado_em`, `expira_em`, `status`, `token_uso_unico`.
- Novo endpoint REST `POST /admin/users/invitations` (admin-only) que cria convite e retorna token.
- Novo endpoint REST `GET /admin/users/invitations` (admin-only) lista convites com filtro por status.
- Novo endpoint REST `DELETE /admin/users/invitations/:id` (admin-only) revoga convite pendente.
- Pre-criação opcional do registro `Usuario` (status pendente) na criação do convite, com `id_provedor=null`.
- Provisioning logic em `src/mcp/oauth/provisioning.ts` consulta convites por email ao invés de allowlist.
- Convite consumido tem status mudado para `aceito` e `usuario_id` populado.
- Convite expirado ou revogado SHALL rejeitar provisionamento com `code: "INVITATION_REQUIRED"`.
- **BREAKING:** `MCP_PROVISIONING_ALLOWED_EMAILS` deprecada; aceita por 1 release com WARN log apontando para o novo fluxo, depois removida.
- Documentação `docs/mcp.md`: nova seção "Onboarding via convite", checklist Auth0, exemplos curl.

## Capabilities

### New Capabilities
- `mcp-user-invitation`: emissão, listagem, revogação e consumo de convites para provisionamento de usuários MCP via Auth0.

### Modified Capabilities
<!-- Nenhuma. `user-provisioning` cobre fluxo Google OIDC da API principal (in-scope dele); `mcp-service-account` cobre auth M2M. O gate de convite aplica-se exclusivamente ao caminho MCP humano via Auth0, descrito no novo `mcp-user-invitation`. -->


## Impact

- **Banco**: nova migration Drizzle (`convites_usuario` + FK opcional para `usuarios`).
- **Código**:
  - `src/services/invitation-service.ts` (novo).
  - `src/routes/admin/invitations.ts` (novo).
  - `src/mcp/oauth/provisioning.ts` (refator: consulta DB ao invés de env var).
  - `src/config.ts` (deprecar `MCP_PROVISIONING_ALLOWED_EMAILS`).
- **Testes**: vitest unit + integration; hurl e2e para endpoints admin.
- **Docs**: `docs/mcp.md` seção convite + checklist deprecation.
- **Operações**: admin precisa de fluxo para gerar convite antes do user logar (UI fora de escopo — só API REST aqui).

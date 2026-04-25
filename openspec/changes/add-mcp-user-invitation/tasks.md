## 1. Modelagem & Migration

- [ ] 1.1 Adicionar schema Drizzle `convites_usuario` em `src/db/schema.ts` com colunas conforme spec
- [ ] 1.2 Gerar migration via `drizzle-kit generate`
- [ ] 1.3 Adicionar índice em `email` e UNIQUE em `token_uso_unico`
- [ ] 1.4 Rodar migration local e validar tabela criada (`docker compose exec db psql ...`)

## 2. Service de convites

- [ ] 2.1 Criar `src/services/invitation-service.ts` com funções `createInvitation`, `listInvitations`, `revokeInvitation`, `findPendingByEmail`, `acceptInvitation`
- [ ] 2.2 Implementar normalização de email (lowercase + trim) compartilhada
- [ ] 2.3 Implementar lógica de "duplicate pendente" detectando convite ativo por email
- [ ] 2.4 Implementar transição de status com guards (`pendente → aceito`, `pendente → revogado`)
- [ ] 2.5 Implementar cálculo on-the-fly de `expirado` em queries de listagem
- [ ] 2.6 Adicionar erros de domínio: `DuplicateInvitationError`, `InvalidTransitionError` em `src/lib/errors.ts`

## 3. Endpoints REST admin

- [ ] 3.1 Criar `src/routes/admin/invitations.ts` com `POST`, `GET`, `DELETE`
- [ ] 3.2 Aplicar `requireAdmin()` guard em todas as rotas
- [ ] 3.3 Validar input com Zod (email RFC, `expiraEmDias` 1-90)
- [ ] 3.4 Mapear erros de domínio para HTTP (409 para duplicate/transition, 404 para not found)
- [ ] 3.5 Registrar rotas em `src/server.ts`

## 4. Refator do provisioning MCP

- [ ] 4.1 Modificar `src/mcp/oauth/provisioning.ts` para consultar `convites_usuario` por email
- [ ] 4.2 Implementar transação atômica (consultar convite + criar user + atualizar convite)
- [ ] 4.3 Tratar race condition via `INSERT ... ON CONFLICT (email) DO NOTHING` ou retry após `unique_violation`
- [ ] 4.3.1 Implementar cross-provider link: se email já existe em `usuarios` com `id_provedor` diferente E convite válido, fazer `UPDATE usuarios SET id_provedor=<sub novo>` ao invés de INSERT; convite marcado `aceito` apontando pra row existente
- [ ] 4.3.2 Sem convite válido + email já existente → rejeitar com `INVITATION_REQUIRED` (não vincular automático)
- [ ] 4.4 Substituir mensagem `not in allowlist` por payload estruturado `INVITATION_REQUIRED` com `hint`
- [ ] 4.5 Manter fallback para `MCP_PROVISIONING_ALLOWED_EMAILS` (consultada apenas se nenhum convite encontrado)
- [ ] 4.6 Emitir WARN log no boot se `MCP_PROVISIONING_ALLOWED_EMAILS` está presente

## 5. Config & deprecation

- [ ] 5.1 Adicionar `MCP_INVITATION_TTL_DAYS_DEFAULT` em `src/config.ts` (default 7, max 90)
- [ ] 5.2 Marcar `MCP_PROVISIONING_ALLOWED_EMAILS` como deprecada no schema com comentário
- [ ] 5.3 Adicionar entrada de CHANGELOG explicando deprecation + janela de remoção

## 6. Testes vitest

- [ ] 6.1 Unit tests para `invitation-service.ts` cobrindo todos os métodos e erros
- [ ] 6.2 Test para race condition (criar dois users em paralelo, garantir um vence sem duplicata)
- [ ] 6.3 Integration test para endpoints admin (POST/GET/DELETE) com user admin e não-admin
- [ ] 6.4 Test do gate de provisioning: convite válido, ausente, expirado, revogado, email mismatch
- [ ] 6.4.1 Test cross-provider link: user Google OIDC pré-existente + convite válido → UPDATE id_provedor, sem INSERT
- [ ] 6.4.2 Test cross-provider sem convite: rejeita com INVITATION_REQUIRED, não toca row existente
- [ ] 6.5 Test de deprecation: var presente emite WARN; convite tem precedência sobre allowlist
- [ ] 6.6 Test de email normalization (case-insensitive + trim)

## 7. Testes E2E hurl

- [ ] 7.1 Adicionar cenários em `.hurl/e2e.hurl`: criar convite, listar, filtrar, revogar
- [ ] 7.2 Adicionar cenário: tentar admin endpoint sem token → 401
- [ ] 7.3 Adicionar cenário: tentar admin endpoint com token não-admin → 403

## 8. Documentação

- [ ] 8.1 Adicionar seção "Onboarding via convite" em `docs/mcp.md`
- [ ] 8.2 Documentar exemplos curl para os 3 endpoints
- [ ] 8.3 Adicionar nota de deprecation de `MCP_PROVISIONING_ALLOWED_EMAILS` com data alvo
- [ ] 8.4 Atualizar `.env.example` com nova var `MCP_INVITATION_TTL_DAYS_DEFAULT`
- [ ] 8.5 Adicionar entrada na seção "Erros estruturados" cobrindo `INVITATION_REQUIRED`

## 9. Validação final

- [ ] 9.1 Rodar `npm run test` verde
- [ ] 9.2 Rodar `npm run test:hurl` verde
- [ ] 9.3 Rodar `npm run mcp:audit-descriptions` e `npm run mcp:audit-names` verde
- [ ] 9.4 Validar manualmente fluxo via MCP Inspector contra dev local
- [ ] 9.5 Smoke em produção após deploy: criar convite, login como user novo, verificar acesso

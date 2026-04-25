## Context

`src/mcp/oauth/provisioning.ts` decide se um `sub` desconhecido é provisionado consultando a env var `MCP_PROVISIONING_ALLOWED_EMAILS` (CSV com regex). Sempre que um novo usuário precisa acessar o MCP em produção, é necessário editar o `.env`, redeployar e reiniciar o container. Isso acopla controle de acesso a config de infra, polui histórico de deploy e impede self-service ou onboarding via UI.

A maioria das stacks SaaS modernas usa convite persistido em DB: admin cria convite com `email` + TTL, sistema pré-cria registro pendente, primeiro login com email matching ativa o user. É o padrão esperado pelo time e elimina deploy-on-onboard.

Stakeholders: admins (emitem convite), usuários finais (recebem link/conhecem o fluxo Auth0), engenharia (mantém DB ao invés de var de ambiente).

## Goals / Non-Goals

**Goals:**
- Substituir gate via env var por gate via tabela `convites_usuario` consultada in-process.
- Endpoints REST admin-only para CRUD básico de convites (criar, listar, revogar).
- Erro estruturado distinto (`INVITATION_REQUIRED`) quando login chega sem convite válido.
- Compatibilidade temporária com a env var (1 release de window) para não quebrar prod.
- Convite tem TTL configurável e status (pendente, aceito, expirado, revogado).

**Non-Goals:**
- UI admin (só REST nesta change; UI vira change separada).
- Envio de email com link (somente token retornado na resposta — admin pode encaminhar manualmente).
- Self-signup ou aprovação multi-step.
- Convites por organização/conta (apenas global por enquanto — escopo conta fica para change futura).
- Rotação automática de convites expirados (cleanup manual via DELETE ou job futuro).

## Decisions

### Decision: Convite consultado em DB durante provisioning
`provisioning.ts` passa a consultar `convites_usuario` por email do claim. Convite com `status='pendente'` e `expira_em > now()` autoriza criação do usuário. Após criação, convite vira `aceito` e ganha FK para o `usuario_id`.

**Alternativa considerada:** manter env var + adicionar UI que escreve no `.env`. Rejeitada — operacionalmente frágil, hot-reload de env é complexo no Docker, não cobre auditoria.

### Decision: Tabela `convites_usuario` separada de `usuarios`
Convite é entidade distinta com lifecycle próprio (status, expiração, quem criou). NÃO criar `Usuario` pendente up-front — convite vira `usuarios` apenas no consumo. Isso evita registros zumbi e simplifica modelagem.

**Alternativa considerada:** registro `Usuario` com `status='pendente'`. Rejeitada — adiciona estado a uma tabela que hoje só tem usuários ativos; complica queries de listagem.

### Decision: Token de uso único + expiração curta
Cada convite tem `token_uso_unico` (UUID v4 sem hash; transmitido na resposta) e `expira_em` default 7 dias. Token é descritivo, não cripto-secreto — autenticação real continua sendo Auth0; token apenas correlaciona convite a aceite quando admin quer rastrear via API. Match real é por email do claim.

**Alternativa considerada:** sem token, só email. Rejeitada — perde rastreabilidade de quem aceitou qual convite quando admin quer auditoria; também impede reemissão idempotente.

### Decision: Endpoints REST sob `/admin/*` reusando `requireAdmin()`
Reaproveita guard existente em `src/plugins/auth-guard.ts:122`. Não adiciona novo plugin de auth. Endpoints documentados no Hurl (`tests/.hurl/e2e.hurl`).

**Alternativa considerada:** namespace separado `/invitations`. Rejeitada — quebra convenção do projeto de agrupar admin features sob `/admin/*`.

### Decision: Deprecation gradual de `MCP_PROVISIONING_ALLOWED_EMAILS`
Por 1 release: se env var presente, log WARN apontando para nova rota e ainda aceita. Após o release, remover suporte. Documentar deprecation em `docs/mcp.md` + CHANGELOG.

**Alternativa considerada:** breaking imediato. Rejeitada — viola semver implícito do projeto e quebra envs hoje em uso (incluindo dev local).

## Risks / Trade-offs

- **Risco:** Admin esquece de criar convite antes do user logar → user vê erro `INVITATION_REQUIRED`. → Mitigação: erro estruturado com `hint` claro citando o endpoint admin; doc explícita.
- **Risco:** Email do claim Auth0 difere do email no convite (case, alias com `+`). → Mitigação: normalização lowercase + trim em ambas pontas; doc nota sobre aliases não suportados na primeira versão.
- **Risco:** Convite expirado bloqueia user já provisionado. → Mitigação: lookup primeiro por `sub` (igual hoje); convite só é consultado quando `sub` é novo.
- **Risco:** Race entre dois logins paralelos do mesmo email recém-convidado. → Mitigação: constraint UNIQUE em `usuarios.email` + retry com lookup; primeiro vencedor consome convite, segundo vê user já criado.
- **Risco:** Email do claim Auth0 colide com row pré-existente criada via Google OIDC main API (`id_provedor` diferente, mesmo email) → INSERT viola UNIQUE. → Mitigação: provisioning faz lookup por email antes de INSERT; se row existe E convite válido, UPDATE `id_provedor` pra Auth0 sub (cross-provider link autorizado pelo convite). Sem convite válido, rejeita com `INVITATION_REQUIRED` — admin precisa emitir convite explícito pra autorizar a vinculação.
- **Risco:** Admin perde token retornado e não consegue rastrear. → Mitigação: GET listagem mostra token (admin-only); convite revogável e reemissível.

## Migration Plan

1. Migration Drizzle adiciona tabela `convites_usuario` (não modifica `usuarios`).
2. Deploy com flag interna `INVITATION_FLOW_ENABLED=false` (default) — provisioning continua usando env var.
3. Admin cria convites para usuários atuais via endpoint (script de seed opcional para popular convite por cada email da `MCP_PROVISIONING_ALLOWED_EMAILS` atual).
4. Flip `INVITATION_FLOW_ENABLED=true`. Provisioning passa a consultar DB. Env var ainda aceita (fallback) com WARN.
5. Próximo release: remover env var e flag — DB vira único caminho.
6. Rollback: virar `INVITATION_FLOW_ENABLED=false`. Tabela permanece (backward compatible).

## Open Questions

- Convite por org/conta vai ser necessário em iteração próxima? Se sim, definir agora se schema deve já incluir `conta_id` nullable. **Decisão tentativa:** não incluir; modelar quando precisar.
- Token deve ser hash (resistente a leak no log) ou plain UUID? **Decisão tentativa:** plain UUID, pois não é secret — Auth0 ainda autentica.
- TTL default 7 dias é apropriado para o produto? Validar com produto; configurável via env (`MCP_INVITATION_TTL_DAYS`).

## Why

A Etapa 1 entregou a fundação (Fastify, Drizzle, Docker, error handling, testes). Porém, todas as rotas estão abertas — qualquer request é aceita sem identificação do usuário. Para avançar com as features de negócio (contas, movimentações, projeções), é necessário saber **quem** está fazendo cada operação. Sem autenticação, não há como implementar RBAC por conta, auditoria via `userId`, nem provisionamento de usuários.

## What Changes

- Integração com provedor OIDC via `openid-client` para validação de Bearer Tokens (id_token)
- Auth Guard como plugin Fastify que intercepta todas as rotas protegidas, valida o token com a chave pública do provedor e injeta `userId` + claims no request
- Provisionamento automático de usuário: no primeiro acesso, se o `sub` do token não existe no banco, cria o registro `Usuario` com `nome`, `email` e `id_provedor` extraídos das claims
- Schema Drizzle para a entidade `Usuario` com campo `is_admin` (papel global)
- Migration para criar a tabela `usuarios`
- Decorator Fastify para expor dados do usuário autenticado no request (`request.user`)
- Rota `GET /me` para o usuário consultar seu próprio perfil

## Capabilities

### New Capabilities

- `oidc-integration`: Configuração do openid-client, discovery do provedor OIDC e validação de tokens JWT
- `auth-guard`: Plugin Fastify que protege rotas, valida Bearer Token e injeta dados do usuário no request
- `user-provisioning`: Provisionamento automático de usuário no primeiro acesso e entidade Usuario no banco
- `admin-roles`: Campo `is_admin` e lógica de papéis globais (nível de sistema)

### Modified Capabilities

(nenhuma — não há specs existentes ainda)

## Impact

- **Código**: Novos arquivos em `src/plugins/` (auth guard), `src/services/` (user service), `src/routes/` (rota /me), `src/db/schema.ts` (entidade Usuario)
- **Banco de dados**: Nova tabela `usuarios` via migration Drizzle
- **Dependências**: Adição de `openid-client` ao package.json
- **API**: Todas as rotas (exceto `/health`) passam a exigir Bearer Token no header `Authorization`
- **Testes**: Necessário mock/stub de token OIDC para testes de integração
- **Configuração**: Novas variáveis de ambiente (`OIDC_ISSUER_URL`, opcionalmente `OIDC_CLIENT_ID`)

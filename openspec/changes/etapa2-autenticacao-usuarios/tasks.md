## 1. Dependências e configuração

- [ ] 1.1 Instalar `openid-client` como dependência de produção
- [ ] 1.2 Adicionar variáveis `OIDC_ISSUER_URL` e `OIDC_AUDIENCE` (opcional) ao `src/config.ts` com validação obrigatória de `OIDC_ISSUER_URL` no bootstrap
- [ ] 1.3 Atualizar `docker-compose.yml` com variáveis de ambiente OIDC para o serviço `api`

## 2. Entidade Usuario e migration

- [ ] 2.1 Criar schema Drizzle da tabela `usuarios` em `src/db/schema.ts` com campos: `id` (UUID PK), `id_provedor` (VARCHAR UNIQUE NOT NULL), `nome` (VARCHAR NOT NULL), `email` (VARCHAR UNIQUE NOT NULL), `is_admin` (BOOLEAN DEFAULT false), `created_at`, `updated_at`
- [ ] 2.2 Gerar migration via `drizzle-kit generate` e verificar o SQL gerado
- [ ] 2.3 Testar migration com `drizzle-kit migrate` contra o PostgreSQL do Docker Compose

## 3. OIDC Integration

- [ ] 3.1 Criar `src/plugins/oidc.ts` com função de inicialização que faz OIDC Discovery no bootstrap, obtém e cacheia as chaves públicas (JWKS) do provedor
- [ ] 3.2 Implementar função `validateToken(token: string)` que valida assinatura, `exp`, `iss` e opcionalmente `aud`, retornando as claims do token
- [ ] 3.3 Tratar erros de discovery no bootstrap (provedor inválido/indisponível) com mensagem clara

## 4. Auth Guard

- [ ] 4.1 Criar `src/plugins/auth-guard.ts` como plugin Fastify que registra hook `onRequest` global
- [ ] 4.2 Implementar extração do Bearer Token do header `Authorization`, rejeitando formatos inválidos com `401` e `code: "AUTH_REQUIRED"`
- [ ] 4.3 Integrar validação de token via OIDC plugin, retornando `401` com códigos específicos (`TOKEN_EXPIRED`, `TOKEN_INVALID`)
- [ ] 4.4 Implementar mecanismo de skip para rotas públicas (`/health`) via decorator `skipAuth` ou lista de rotas
- [ ] 4.5 Criar decorator `fastify.decorateRequest('user', null)` com tipo `AuthUser` (`id`, `idProvedor`, `nome`, `email`, `isAdmin`)

## 5. User Provisioning

- [ ] 5.1 Criar `src/services/user-service.ts` com função `findOrCreateUser(claims)` que busca por `id_provedor` e cria se não existir
- [ ] 5.2 Integrar provisionamento no Auth Guard: após validação do token, chamar `findOrCreateUser` e popular `request.user`
- [ ] 5.3 Tratar claim `email` ausente retornando `401` com `code: "CLAIMS_INSUFFICIENT"`
- [ ] 5.4 Tratar violação de UNIQUE em `email` (mesmo email de outro provedor) com erro adequado

## 6. Admin roles

- [ ] 6.1 Criar helper `requireAdmin` em `src/plugins/auth-guard.ts` (ou `src/lib/guards.ts`) como hook `onRequest` que verifica `request.user.isAdmin` e retorna `403` com `code: "ADMIN_REQUIRED"` se `false`
- [ ] 6.2 Exportar o helper para uso em rotas futuras (categorias admin)

## 7. Rota GET /me

- [ ] 7.1 Criar `src/routes/me.ts` com rota `GET /me` que retorna `{ id, nome, email, isAdmin }` de `request.user`
- [ ] 7.2 Registrar a rota no `app.ts`

## 8. Testes de integração

- [ ] 8.1 Criar helper `tests/helpers/auth.ts` que gera JWTs assinados com chave RSA efêmera para testes
- [ ] 8.2 Configurar injeção de `jwksProvider` no auth guard para usar chave efêmera nos testes
- [ ] 8.3 Criar `tests/auth-guard.test.ts` — testes: request sem token (401), token inválido (401), token expirado (401), token válido (200), rota pública sem token (200)
- [ ] 8.4 Criar `tests/user-provisioning.test.ts` — testes: primeiro acesso cria usuário, segundo acesso reutiliza, token sem email (401)
- [ ] 8.5 Criar `tests/me.test.ts` — testes: GET /me autenticado (200 com dados), GET /me sem token (401)
- [ ] 8.6 Criar `tests/admin-guard.test.ts` — testes: admin acessa rota protegida (200), não-admin recebe 403

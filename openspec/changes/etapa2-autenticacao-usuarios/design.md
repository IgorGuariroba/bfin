## Context

A Etapa 1 entregou a fundação: Fastify com Pino, Drizzle ORM + PostgreSQL, Docker Compose, error handling padronizado e testes de integração com testcontainers. Todas as rotas estão abertas — não há identificação de quem faz cada request. Esta etapa adiciona autenticação OIDC e a entidade Usuario, habilitando as features de negócio das etapas seguintes (contas, movimentações, RBAC contextual).

Stack existente: Node.js + Fastify + Drizzle ORM + PostgreSQL + TypeScript.

## Goals / Non-Goals

**Goals:**
- Validar Bearer Tokens (id_token OIDC) em todas as rotas protegidas usando `openid-client`
- Provisionar automaticamente o usuário no banco no primeiro acesso (sem cadastro manual)
- Expor dados do usuário autenticado (`userId`, `email`, `nome`, `isAdmin`) no objeto request
- Criar a tabela `usuarios` com migration Drizzle
- Fornecer rota `GET /me` para consulta do perfil do usuário autenticado
- Suportar o campo `is_admin` para papéis globais (gerenciamento de categorias)

**Non-Goals:**
- RBAC por conta financeira (owner/viewer) — Etapa 3, quando contas forem implementadas
- Tela de login ou fluxo OAuth no frontend — a API apenas recebe e valida tokens
- Gerenciamento de sessão ou refresh tokens — a API é stateless, cada request traz seu token
- Gerenciamento de provedores múltiplos simultâneos — um provedor OIDC configurado por instância
- Rota de criação manual de usuários (`POST /usuarios`)

## Decisions

### 1. openid-client v6 com OIDC Discovery

Usar `openid-client` para descobrir automaticamente as chaves públicas do provedor via `.well-known/openid-configuration`. A biblioteca cuida do cache de JWKS e rotação de chaves.

**Alternativa descartada:** Validação manual de JWT com `jose` — exigiria implementar discovery, cache de JWKS e rotação de chaves manualmente. `openid-client` encapsula tudo isso.

### 2. Auth Guard como plugin Fastify com `onRequest` hook

Criar um plugin Fastify que registra um hook `onRequest` global. O hook:
1. Extrai o token do header `Authorization: Bearer <token>`
2. Valida o token com a chave pública do provedor (via openid-client)
3. Extrai claims (`sub`, `name`, `email`)
4. Busca/cria o usuário no banco (provisionamento)
5. Decora o request com `request.user` contendo os dados do usuário

Rotas públicas (`/health`) são excluídas via configuração no plugin (lista de rotas ou decorator `skipAuth`).

**Alternativa descartada:** Middleware separado por rota — mais verboso e propenso a esquecer de proteger uma rota nova.

### 3. Provisionamento inline no Auth Guard

O provisionamento (buscar ou criar usuário) acontece dentro do próprio Auth Guard, no hook `onRequest`. Isso garante que `request.user` sempre contém o usuário completo do banco (com `id`, `isAdmin`, etc.) — não apenas claims do token.

**Alternativa descartada:** Provisionamento lazy em um service separado chamado pelas rotas — duplicaria a lógica de "já existe?" em múltiplos pontos.

### 4. Decorator Fastify para `request.user`

Usar `fastify.decorateRequest('user', null)` para tipar o objeto user no request. O tipo inclui:

```typescript
interface AuthUser {
  id: string          // UUID do banco
  idProvedor: string  // sub do token OIDC
  nome: string
  email: string
  isAdmin: boolean
}
```

### 5. Entidade Usuario — Drizzle schema + migration

Tabela `usuarios` conforme o plano:
- `id` (UUID PK, gerado pelo banco)
- `id_provedor` (VARCHAR UNIQUE NOT NULL) — `sub` do token OIDC
- `nome` (VARCHAR NOT NULL)
- `email` (VARCHAR UNIQUE NOT NULL)
- `is_admin` (BOOLEAN DEFAULT false)
- `created_at`, `updated_at` (TIMESTAMP)

Migration gerada via `drizzle-kit generate`.

### 6. Testes — JWT assinado com chave efêmera

Para testes de integração, criar um helper que gera JWTs assinados com uma chave RSA efêmera. O auth guard nos testes usará essa chave para validação, simulando o fluxo OIDC sem depender de um provedor externo.

Abordagem: configurar o auth guard para aceitar um `jwksProvider` injetável — em produção usa openid-client discovery, em testes usa a chave efêmera.

**Alternativa descartada:** Mock completo do auth guard nos testes — perderia cobertura da lógica de validação e provisionamento.

### 7. Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `OIDC_ISSUER_URL` | Sim | URL do provedor (ex: `https://accounts.google.com`) |
| `OIDC_AUDIENCE` | Não | Audience esperada no token (validação extra) |

O discovery URL é derivado automaticamente: `${OIDC_ISSUER_URL}/.well-known/openid-configuration`.

## Risks / Trade-offs

- **[Latência no primeiro request]** → O discovery OIDC e download de JWKS acontecem no bootstrap da aplicação (eager loading), não no primeiro request. Mitiga cold-start.
- **[Provedor OIDC indisponível]** → Se o provedor cair após o bootstrap, tokens não podem ser validados. Risco aceitável — sem provedor, não há como autenticar. O `openid-client` faz cache das chaves.
- **[Provisionamento no hot path]** → Cada request faz um SELECT para buscar o usuário. Trade-off aceitável para manter simplicidade. Otimização com cache in-memory pode ser adicionada futuramente se necessário.
- **[is_admin manual]** → O campo `is_admin` só pode ser alterado diretamente no banco (ou via seed). Não há rota admin para promover usuários nesta etapa. Suficiente para o MVP.

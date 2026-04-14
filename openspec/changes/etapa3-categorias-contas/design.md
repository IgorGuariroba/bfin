## Context

A Etapa 1 entregou a fundação (Fastify, Drizzle, Docker, error handling padronizado, testes de integração). A Etapa 2 entregou autenticação OIDC, Auth Guard e provisionamento de usuários com campo `is_admin`. Agora é necessário construir as entidades de negócio fundamentais — Categorias e Contas — que servem como base para todas as features subsequentes (movimentações, dívidas, projeções).

O modelo de dados do plano define Categorias como taxonomia global gerenciada por admin, e Contas como unidade central compartilhável com RBAC contextual (owner/viewer).

## Goals / Non-Goals

**Goals:**

- Implementar CRUD completo de Categorias com guard de admin
- Implementar CRUD de Contas com associação automática do criador como owner
- Implementar tabela de associação `ContaUsuario` com papéis owner/viewer
- Criar middleware reutilizável de autorização por conta para uso nas etapas seguintes
- Seed de TipoCategoria com valores iniciais (receita, despesa, divida)
- Paginação padronizada em listagens (padrão já estabelecido no plano)

**Non-Goals:**

- Movimentações, dívidas ou projeções (Etapas 4+)
- Interface de admin separada — o controle é via `is_admin` no token/usuário
- Remoção de membros de uma conta (não especificado no plano v2)
- Notificações sobre associação de membros

## Decisions

### 1. TipoCategoria como tabela vs. ENUM

**Decisão**: Tabela `tipo_categorias` com seed.

**Alternativa**: ENUM PostgreSQL ou check constraint.

**Razão**: O plano define TipoCategoria como entidade separada com `id`, `slug`, `nome`, `created_at`, `updated_at`. Usar tabela permite extensibilidade futura sem migrations destrutivas. O seed inicial popula `receita`, `despesa` e `divida`.

### 2. Middleware de autorização por conta — Plugin Fastify com decorator

**Decisão**: Criar um plugin Fastify `accountAuthorization` que expõe um decorator/hook parametrizável. As rotas declaram o papel mínimo exigido (ex: `requireRole: 'owner'`).

**Alternativa**: Verificação inline em cada handler.

**Razão**: O RBAC por conta será usado em todas as rotas de movimentações, dívidas, metas e projeções. Centralizar evita duplicação e inconsistência. O middleware extrai `contaId` do path param, consulta `ContaUsuario` e compara o papel.

### 3. Resolução do contaId no middleware

**Decisão**: O middleware espera `contaId` como path param (`:contaId`). Para rotas que não têm contaId no path (ex: `POST /movimentacoes` com contaId no body), o middleware será flexível o suficiente para extrair de ambos os lugares.

**Razão**: O plano define rotas como `/contas/{contaId}/usuarios` (path) e `POST /movimentacoes` com `contaId` no body. O middleware precisa lidar com ambos os padrões.

### 4. Paginação

**Decisão**: Usar o padrão do plano — query params `page` e `limit` com defaults (page=1, limit=10). Response inclui `meta` (categorias) ou `pagination` (contas) conforme definido no contrato de cada rota.

**Razão**: Seguir exatamente o contrato da API definido no plano.

### 5. Validação de deleção de categorias

**Decisão**: Ao tentar deletar uma categoria, verificar se existem movimentações ou dívidas referenciando-a. Se existirem, retornar 422.

**Razão**: Definido nas regras de negócio (seção 6.3 do plano). Implementação via COUNT query antes do DELETE, sem FK cascade.

## Risks / Trade-offs

- **[Performance em verificação de vínculos]** → A verificação de registros vinculados antes de deletar categorias faz queries extras. Mitigação: as queries usam índices FK e o volume de categorias é baixo (operação admin rara).

- **[Race condition na associação de membros]** → Dois owners podem tentar associar o mesmo usuário simultaneamente. Mitigação: constraint UNIQUE em `(conta_id, usuario_id)` na tabela `conta_usuarios` — o banco garante idempotência.

- **[Middleware de autorização em rotas sem contaId]** → Rotas futuras como `POST /movimentacoes` terão contaId no body, não no path. Mitigação: o middleware será projetado para aceitar uma função extratora configurável.

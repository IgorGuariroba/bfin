## Why

A Etapa 2 entregou autenticação OIDC, provisionamento de usuários e o Auth Guard. Agora sabemos **quem** faz cada operação, mas ainda não há **sobre o quê** operar. Categorias e Contas são as entidades fundacionais de negócio — sem elas, não é possível registrar movimentações, dívidas ou projeções. Além disso, o RBAC contextual (owner/viewer por conta) é pré-requisito para todas as rotas de escrita das etapas seguintes.

## What Changes

- CRUD completo de Categorias (POST, GET, PUT, DELETE) restrito a usuários `admin` (papel global), com filtro por tipo e busca por nome
- Entidade TipoCategoria com seed de dados iniciais (`receita`, `despesa`, `divida`)
- CRUD de Contas Financeiras: criação (POST), listagem do usuário (GET), atualização (PATCH)
- Associação Usuário ↔ Conta via tabela `ContaUsuario` com papéis `owner`/`viewer`
- Rota `POST /contas/{contaId}/usuarios` para associar membros (restrito a `owner`)
- Middleware de autorização por conta que verifica papel do usuário antes de permitir operações de escrita
- Schemas Drizzle para `categorias`, `tipo_categorias`, `contas` e `conta_usuarios`
- Migrations para criar as tabelas no PostgreSQL

## Capabilities

### New Capabilities

- `category-management`: CRUD de Categorias com controle de acesso admin, validação de unicidade nome+tipo e proteção contra deleção com registros vinculados
- `account-management`: CRUD de Contas Financeiras com saldo inicial, listagem paginada por usuário e associação automática do criador como owner
- `account-authorization`: RBAC contextual por conta (owner/viewer), middleware de autorização que intercepta rotas de conta e valida papel do usuário

### Modified Capabilities

(nenhuma — não há specs existentes ainda)

## Impact

- **Código**: Novos schemas Drizzle em `src/db/schema/`, services em `src/services/`, routes em `src/routes/`, middleware de autorização em `src/plugins/`
- **Banco de dados**: Novas tabelas `tipo_categorias`, `categorias`, `contas`, `conta_usuarios` via migrations Drizzle
- **API**: Novas rotas `/categorias` (CRUD), `/contas` (CRUD), `/contas/{contaId}/usuarios` (associação de membros)
- **Segurança**: Middleware RBAC que verifica papel do usuário na conta antes de operações de escrita; guard admin para rotas de categoria
- **Testes**: Testes de integração para cada rota cobrindo cenários de permissão (admin, owner, viewer, sem acesso)

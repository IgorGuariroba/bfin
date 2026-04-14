## 1. Schema e Migrations

- [ ] 1.1 Criar schema Drizzle para `tipo_categorias` (id, slug, nome, created_at, updated_at)
- [ ] 1.2 Criar schema Drizzle para `categorias` (id, nome, tipo_categoria_id FK, created_at, updated_at) com UNIQUE(nome, tipo_categoria_id)
- [ ] 1.3 Criar schema Drizzle para `contas` (id, nome, saldo_inicial DECIMAL(12,2) default 0.00, created_at, updated_at)
- [ ] 1.4 Criar schema Drizzle para `conta_usuarios` (id, conta_id FK, usuario_id FK, papel ENUM owner/viewer, created_at) com UNIQUE(conta_id, usuario_id)
- [ ] 1.5 Gerar e executar migration para criar as 4 tabelas
- [ ] 1.6 Criar migration seed para popular `tipo_categorias` com receita, despesa e divida

## 2. Guards e Middleware de Autorização

- [ ] 2.1 Criar guard de admin (preHandler) que verifica `is_admin = true` no usuário autenticado e retorna 403 se não for admin
- [ ] 2.2 Criar middleware de autorização por conta que extrai contaId (path param ou body), consulta conta_usuarios e valida papel mínimo (owner > viewer)
- [ ] 2.3 Tratar cenários de erro no middleware: conta inexistente (404), sem associação (403), papel insuficiente (403)

## 3. CRUD de Categorias

- [ ] 3.1 Criar service de categorias com métodos create, findAll, findById, update, delete
- [ ] 3.2 Implementar rota POST /categorias (guard admin, validação nome+tipo, 201/403/422)
- [ ] 3.3 Implementar rota GET /categorias (autenticado, filtros tipo/busca, paginação com meta)
- [ ] 3.4 Implementar rota PUT /categorias/{categoriaId} (guard admin, 200/403/404/422)
- [ ] 3.5 Implementar rota DELETE /categorias/{categoriaId} (guard admin, verificação de vínculos, 200/403/404/422)

## 4. CRUD de Contas

- [ ] 4.1 Criar service de contas com métodos create, findByUser, findById, update
- [ ] 4.2 Implementar rota POST /contas (autenticado, criação + associação owner automática, 201)
- [ ] 4.3 Implementar rota GET /contas (autenticado, listagem por usuário com papel, paginação, busca)
- [ ] 4.4 Implementar rota PATCH /contas/{contaId} (middleware owner, 200/403/404)

## 5. Associação de Membros

- [ ] 5.1 Criar service de associação com método addMember (busca usuário por email, cria conta_usuarios)
- [ ] 5.2 Implementar rota POST /contas/{contaId}/usuarios (middleware owner, 201/403/404/422)

## 6. Testes de Integração

- [ ] 6.1 Testes do guard admin (admin permitido, não-admin bloqueado)
- [ ] 6.2 Testes do middleware de autorização por conta (owner ok, viewer bloqueado em escrita, sem associação bloqueado, conta inexistente)
- [ ] 6.3 Testes CRUD categorias (criar, listar com filtros, atualizar, deletar, deletar com vínculos)
- [ ] 6.4 Testes CRUD contas (criar com/sem saldo, listar do usuário, atualizar como owner/viewer)
- [ ] 6.5 Testes associação de membros (associar ok, viewer tenta, email inexistente, duplicata)

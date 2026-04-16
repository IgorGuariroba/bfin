## ADDED Requirements

### Requirement: Seed de TipoCategoria
O sistema SHALL popular a tabela `tipo_categorias` com os registros iniciais: `receita`, `despesa` e `divida` via migration seed. Cada registro possui `id` (UUID), `slug` (unique), `nome`, `created_at` e `updated_at`.

#### Scenario: Seed executado na migration
- **WHEN** a migration de seed é executada
- **THEN** a tabela `tipo_categorias` contém exatamente 3 registros com slugs `receita`, `despesa` e `divida`

### Requirement: Criar categoria
Um usuário admin SHALL poder criar uma categoria via `POST /categorias` com `nome` (string obrigatório) e `tipo` (string obrigatório: `receita`, `despesa` ou `divida`). A combinação `(nome, tipo)` MUST ser única. A resposta retorna `201` com `id`, `nome`, `tipo` e `created_at`.

#### Scenario: Admin cria categoria com sucesso
- **WHEN** um usuário com `is_admin = true` envia `POST /categorias` com `{"nome": "Alimentação", "tipo": "despesa"}`
- **THEN** o sistema retorna `201 Created` com o registro da categoria criada

#### Scenario: Usuário não-admin tenta criar categoria
- **WHEN** um usuário com `is_admin = false` envia `POST /categorias`
- **THEN** o sistema retorna `403 Forbidden`

#### Scenario: Combinação nome+tipo duplicada
- **WHEN** um admin envia `POST /categorias` com uma combinação `(nome, tipo)` que já existe
- **THEN** o sistema retorna `422 Unprocessable Entity`

### Requirement: Listar categorias
Qualquer usuário autenticado SHALL poder listar categorias via `GET /categorias` com filtros opcionais por `tipo`, `busca` (parcial por nome), `page` (default 1) e `limit` (default 10). A resposta inclui `data` (array de categorias) e `meta` com informações de paginação (`total`, `page`, `limit`, `total_pages`, `has_next`, `has_prev`).

#### Scenario: Listagem sem filtros
- **WHEN** um usuário autenticado envia `GET /categorias`
- **THEN** o sistema retorna `200 OK` com a primeira página de categorias e metadados de paginação

#### Scenario: Filtro por tipo
- **WHEN** um usuário envia `GET /categorias?tipo=despesa`
- **THEN** o sistema retorna apenas categorias do tipo `despesa`

#### Scenario: Busca por nome parcial
- **WHEN** um usuário envia `GET /categorias?busca=alim`
- **THEN** o sistema retorna categorias cujo nome contém "alim" (case-insensitive)

### Requirement: Atualizar categoria
Um usuário admin SHALL poder atualizar uma categoria via `PUT /categorias/{categoriaId}` com `nome` e `tipo` obrigatórios. A combinação `(nome, tipo)` MUST permanecer única.

#### Scenario: Admin atualiza categoria com sucesso
- **WHEN** um admin envia `PUT /categorias/{categoriaId}` com dados válidos
- **THEN** o sistema retorna `200 OK` com a categoria atualizada

#### Scenario: Categoria não encontrada
- **WHEN** um admin envia `PUT /categorias/{categoriaId}` com um ID inexistente
- **THEN** o sistema retorna `404 Not Found`

#### Scenario: Usuário não-admin tenta atualizar
- **WHEN** um usuário não-admin envia `PUT /categorias/{categoriaId}`
- **THEN** o sistema retorna `403 Forbidden`

### Requirement: Deletar categoria
Um admin SHALL poder deletar uma categoria via `DELETE /categorias/{categoriaId}`. A deleção MUST ser recusada se existirem movimentações ou dívidas vinculadas à categoria.

#### Scenario: Admin deleta categoria sem vínculos
- **WHEN** um admin envia `DELETE /categorias/{categoriaId}` e a categoria não possui registros vinculados
- **THEN** o sistema retorna `200 OK`

#### Scenario: Categoria com registros vinculados
- **WHEN** um admin envia `DELETE /categorias/{categoriaId}` e existem movimentações ou dívidas vinculadas
- **THEN** o sistema retorna `422 Unprocessable Entity` com mensagem indicando registros dependentes

#### Scenario: Categoria não encontrada para deleção
- **WHEN** um admin envia `DELETE /categorias/{categoriaId}` com um ID inexistente
- **THEN** o sistema retorna `404 Not Found`

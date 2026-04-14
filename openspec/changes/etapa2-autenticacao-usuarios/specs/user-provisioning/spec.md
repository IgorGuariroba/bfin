## ADDED Requirements

### Requirement: Provisionamento automático no primeiro acesso
O sistema SHALL criar automaticamente um registro `Usuario` no banco quando um token OIDC válido contém um `sub` que ainda não existe na tabela `usuarios`. Os campos `nome` e `email` SHALL ser extraídos das claims do token.

#### Scenario: Primeiro acesso de um usuário novo
- **WHEN** um request chega com token válido cujo `sub` não existe na coluna `id_provedor` da tabela `usuarios`
- **THEN** o sistema cria um registro `Usuario` com `id_provedor` = `sub`, `nome` extraído de `name` (ou `given_name` + `family_name`), `email` extraído de `email`, `is_admin` = `false`, e prossegue com o request usando o novo usuário

#### Scenario: Acesso de usuário já provisionado
- **WHEN** um request chega com token válido cujo `sub` já existe na coluna `id_provedor`
- **THEN** o sistema carrega o registro existente e prossegue sem criar duplicata

#### Scenario: Token sem claim de email
- **WHEN** um token válido não contém a claim `email`
- **THEN** o sistema retorna `401 Unauthorized` com `code: "CLAIMS_INSUFFICIENT"` e mensagem indicando que a claim `email` é obrigatória

### Requirement: Entidade Usuario no banco de dados
O sistema SHALL manter a tabela `usuarios` com os campos: `id` (UUID PK), `id_provedor` (VARCHAR UNIQUE NOT NULL), `nome` (VARCHAR NOT NULL), `email` (VARCHAR UNIQUE NOT NULL), `is_admin` (BOOLEAN DEFAULT false), `created_at` (TIMESTAMP), `updated_at` (TIMESTAMP).

#### Scenario: Unicidade de id_provedor
- **WHEN** uma tentativa de inserção ocorre com `id_provedor` já existente
- **THEN** o banco rejeita a inserção com violação de constraint UNIQUE

#### Scenario: Unicidade de email
- **WHEN** uma tentativa de inserção ocorre com `email` já existente (vindo de outro provedor/sub)
- **THEN** o banco rejeita a inserção com violação de constraint UNIQUE

### Requirement: Migration Drizzle para tabela usuarios
O sistema SHALL incluir uma migration Drizzle que cria a tabela `usuarios` com todos os campos, constraints UNIQUE em `id_provedor` e `email`, e default para `is_admin`.

#### Scenario: Migration executada com sucesso
- **WHEN** `drizzle-kit migrate` é executado
- **THEN** a tabela `usuarios` é criada no PostgreSQL com todas as colunas e constraints definidas

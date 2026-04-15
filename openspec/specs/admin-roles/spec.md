# admin-roles Specification

## Purpose

Define o papel global `admin` através do campo `is_admin` na tabela `usuarios`, disponibilizando verificação no request e helper para proteção de rotas administrativas, independente de papéis por conta financeira.

## Requirements

### Requirement: Campo is_admin como papel global
O sistema SHALL utilizar o campo `is_admin` (BOOLEAN) na tabela `usuarios` para determinar se um usuário possui o papel global `admin`. Usuários com `is_admin = true` SHALL ter acesso a operações administrativas (ex: gerenciamento de categorias do sistema). O campo `is_admin` é independente de papéis por conta financeira (owner/viewer).

#### Scenario: Usuário provisionado com is_admin default
- **WHEN** um novo usuário é provisionado automaticamente via OIDC
- **THEN** o campo `is_admin` é `false` por padrão

#### Scenario: Usuário admin acessa recurso administrativo
- **WHEN** um usuário com `is_admin = true` faz request a uma rota restrita a admin
- **THEN** o sistema permite o acesso

#### Scenario: Usuário não-admin acessa recurso administrativo
- **WHEN** um usuário com `is_admin = false` faz request a uma rota restrita a admin
- **THEN** o sistema retorna `403 Forbidden` com `code: "ADMIN_REQUIRED"`

### Requirement: Verificação de admin disponível no request
O sistema SHALL disponibilizar o campo `isAdmin` em `request.user` para que qualquer rota possa verificar se o usuário autenticado é admin sem consulta adicional ao banco.

#### Scenario: Rota verifica isAdmin
- **WHEN** uma rota acessa `request.user.isAdmin`
- **THEN** o valor reflete o campo `is_admin` do registro do usuário no banco, carregado durante a autenticação

### Requirement: Helper de guarda admin para rotas
O sistema SHALL fornecer um hook ou helper reutilizável (`requireAdmin`) que pode ser aplicado a rotas específicas para restringir acesso a usuários admin. O helper SHALL verificar `request.user.isAdmin` e retornar `403 Forbidden` se `false`.

#### Scenario: Rota protegida com requireAdmin e usuário admin
- **WHEN** um usuário admin acessa uma rota decorada com `requireAdmin`
- **THEN** o request prossegue normalmente

#### Scenario: Rota protegida com requireAdmin e usuário não-admin
- **WHEN** um usuário não-admin acessa uma rota decorada com `requireAdmin`
- **THEN** o sistema retorna `403 Forbidden` com `code: "ADMIN_REQUIRED"` antes de executar o handler da rota

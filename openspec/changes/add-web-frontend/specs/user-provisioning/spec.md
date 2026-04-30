## MODIFIED Requirements

### Requirement: Provisionamento automático no primeiro acesso
O sistema SHALL criar automaticamente um registro `Usuario` no banco quando um token OIDC válido contém um `sub` que ainda não existe na tabela `usuarios`. Quando o `sub` é desconhecido mas existe um usuário com o mesmo `email` (claim `email_verified === true`), o sistema SHALL re-linkar o registro existente atualizando `id_provedor` para o novo `sub`, em vez de criar duplicata. Os campos `nome` e `email` SHALL ser extraídos das claims do token.

#### Scenario: Primeiro acesso de um usuário novo
- **WHEN** um request chega com token válido cujo `sub` não existe na coluna `id_provedor` e cujo `email` não corresponde a nenhum usuário existente
- **THEN** o sistema cria um registro `Usuario` com `id_provedor` = `sub`, `nome` extraído de `name` (ou `given_name` + `family_name`), `email` extraído de `email`, `is_admin` = `false`, e prossegue com o request usando o novo usuário

#### Scenario: Acesso de usuário já provisionado
- **WHEN** um request chega com token válido cujo `sub` já existe na coluna `id_provedor`
- **THEN** o sistema carrega o registro existente e prossegue sem criar duplicata

#### Scenario: Re-link de usuário migrado de outro provedor
- **WHEN** um request chega com token válido cujo `sub` é desconhecido, cujo `email` corresponde a um usuário existente, e cujo `email_verified` é `true`
- **THEN** o sistema atualiza `id_provedor` do usuário existente para o novo `sub`, preserva `id`, `is_admin`, contas vinculadas e demais dados, e prossegue usando o registro re-linkado

#### Scenario: Re-link bloqueado por email não verificado
- **WHEN** um request chega com token cujo `sub` é desconhecido, cujo `email` corresponde a um usuário existente, mas cuja claim `email_verified` é `false` ou ausente
- **THEN** o sistema retorna `401 Unauthorized` com `code: "EMAIL_NOT_VERIFIED"` e NÃO re-linka nem cria registro

#### Scenario: Token sem claim de email
- **WHEN** um token válido não contém a claim `email`
- **THEN** o sistema retorna `401 Unauthorized` com `code: "CLAIMS_INSUFFICIENT"` e mensagem indicando que a claim `email` é obrigatória

# oidc-integration Specification

## Purpose

Integra o sistema a um provedor OIDC externo via Discovery, valida Bearer Tokens JWT contra o JWKS do provedor e define a configuração obrigatória por variáveis de ambiente.

## Requirements

### Requirement: OIDC Discovery no bootstrap
O sistema SHALL realizar OIDC Discovery (fetch de `.well-known/openid-configuration`) durante o bootstrap da aplicação, antes de aceitar requests. O discovery SHALL obter e cachear o JWKS (JSON Web Key Set) do provedor.

#### Scenario: Bootstrap com provedor OIDC válido
- **WHEN** a aplicação inicia com `OIDC_ISSUER_URL` configurada para um provedor válido
- **THEN** o sistema realiza discovery, cacheia as chaves públicas e fica pronto para validar tokens

#### Scenario: Bootstrap com provedor OIDC inválido
- **WHEN** a aplicação inicia com `OIDC_ISSUER_URL` apontando para um endpoint inexistente ou inválido
- **THEN** o sistema SHALL falhar no bootstrap com erro claro indicando falha no discovery OIDC

### Requirement: Validação de Bearer Token
O sistema SHALL validar tokens JWT recebidos no header `Authorization: Bearer <token>` usando as chaves públicas obtidas via OIDC Discovery. A validação SHALL verificar assinatura, expiração (`exp`) e issuer (`iss`).

#### Scenario: Token válido
- **WHEN** um request chega com Bearer Token válido (assinatura correta, não expirado, issuer correto)
- **THEN** o sistema extrai as claims `sub`, `name` (ou `given_name`+`family_name`) e `email` do token

#### Scenario: Token expirado
- **WHEN** um request chega com Bearer Token cuja claim `exp` já passou
- **THEN** o sistema retorna `401 Unauthorized` com `code: "TOKEN_EXPIRED"`

#### Scenario: Token com assinatura inválida
- **WHEN** um request chega com Bearer Token cuja assinatura não confere com as chaves do provedor
- **THEN** o sistema retorna `401 Unauthorized` com `code: "TOKEN_INVALID"`

#### Scenario: Token com issuer incorreto
- **WHEN** um request chega com Bearer Token cujo `iss` não corresponde ao `OIDC_ISSUER_URL` configurado
- **THEN** o sistema retorna `401 Unauthorized` com `code: "TOKEN_INVALID"`

### Requirement: Configuração via variáveis de ambiente
O sistema SHALL ler a configuração OIDC exclusivamente de variáveis de ambiente. `OIDC_ISSUER_URL` é obrigatória. `OIDC_AUDIENCE` é opcional (quando presente, valida a claim `aud` do token).

#### Scenario: OIDC_ISSUER_URL ausente
- **WHEN** a aplicação inicia sem a variável `OIDC_ISSUER_URL` definida
- **THEN** o sistema SHALL falhar no bootstrap com mensagem de erro indicando a variável obrigatória

#### Scenario: OIDC_AUDIENCE configurada
- **WHEN** `OIDC_AUDIENCE` está definida e um token chega com `aud` diferente do valor configurado
- **THEN** o sistema retorna `401 Unauthorized` com `code: "TOKEN_INVALID"`

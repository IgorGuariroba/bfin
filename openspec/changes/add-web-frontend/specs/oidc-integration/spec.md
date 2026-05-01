## MODIFIED Requirements

### Requirement: Configuração via variáveis de ambiente
O sistema SHALL ler a configuração OIDC exclusivamente de variáveis de ambiente. `OIDC_ISSUER_URL` é obrigatória e SHALL apontar para um tenant Auth0 (formato `https://<tenant>.<region>.auth0.com/`). `OIDC_AUDIENCE` é obrigatória e SHALL corresponder ao API identifier configurado no Auth0; tokens com `aud` diferente SHALL ser rejeitados.

#### Scenario: OIDC_ISSUER_URL ausente
- **WHEN** a aplicação inicia sem a variável `OIDC_ISSUER_URL` definida
- **THEN** o sistema SHALL falhar no bootstrap com mensagem de erro indicando a variável obrigatória

#### Scenario: OIDC_AUDIENCE ausente
- **WHEN** a aplicação inicia sem a variável `OIDC_AUDIENCE` definida
- **THEN** o sistema SHALL falhar no bootstrap com mensagem de erro indicando que `OIDC_AUDIENCE` é obrigatória

#### Scenario: Token com audience incorreta
- **WHEN** um request chega com Bearer Token cujo `aud` não contém o valor de `OIDC_AUDIENCE`
- **THEN** o sistema retorna `401 Unauthorized` com `code: "TOKEN_INVALID"`

#### Scenario: Token com audience correta
- **WHEN** um request chega com Bearer Token cujo `aud` contém o valor de `OIDC_AUDIENCE`
- **THEN** o sistema prossegue com validação normal de assinatura e expiração

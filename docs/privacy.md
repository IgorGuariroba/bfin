## Política de Privacidade — BFin

**Última atualização:** 2026-04-28

### 1. Dados que coletamos

Coletamos apenas os dados estritamente necessários para o funcionamento do serviço:

- **E-mail** — fornecido pelo provedor de identidade (Google via Auth0) durante o login.
- **ID de identidade** (`sub`) — identificador único emitido pelo Auth0.
- **Dados financeiros inseridos pelo usuário** — contas, transações, dívidas, metas e projeções criadas voluntariamente dentro do aplicativo.

### 2. Dados que NÃO coletamos

Não coletamos, processamos nem armazenamos:

- Números de cartão de crédito ou débito.
- Dados de saúde ou informações médicas.
- Documentos oficiais (CPF, RG, passaporte).
- Credenciais bancárias, senhas ou tokens de acesso a instituições financeiras.

### 3. Finalidade de uso

Os dados são utilizados exclusivamente para:

- Permitir o acesso e a gestão das finanças pessoais do usuário.
- Calcular limites diários, projeções e metas com base nos dados inseridos.
- Autenticar e autorizar acessos via OAuth 2.1.

Não utilizamos os dados para publicidade comportamental, perfilamento comercial ou venda a terceiros.

### 4. Retenção e exclusão

- **Retenção:** os dados são mantidos enquanto a conta do usuário estiver ativa.
- **Exclusão:** o usuário pode solicitar a exclusão completa da conta e dos dados via comando `npm run mcp:delete-user` (administrado pelo proprietário do serviço) ou entrando em contato pelo e-mail abaixo.
- **Após exclusão:** os dados são removidos do banco de dados em até 7 dias corridos.

### 5. Subprocessadores

Utilizamos os seguintes subprocessadores para operação do serviço:

| Subprocessador | Função | Localização |
|---|---|---|
| Auth0 (Okta) | Autenticação e autorização (OAuth 2.1) | EUA |
| GitHub Container Registry (GHCR) | Hospedagem de imagens Docker | EUA |

### 6. Direitos do titular (LGPD)

De acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), o titular dos dados possui os seguintes direitos:

- Confirmar a existência de tratamento.
- Acessar os dados.
- Corrigir dados incompletos, inexatos ou desatualizados.
- Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários.
- Portabilidade dos dados para outro serviço.
- Revogar o consentimento a qualquer tempo.

Para exercer seus direitos, envie um e-mail para: **privacidade@bfincont.com.br**

### 7. Segurança

- Comunicação criptografada via TLS 1.3.
- Tokens OAuth com expiração curta (1 hora) e refresh tokens (30 dias).
- Rate limiting por usuário para mitigar abuso.
- Senhas e credenciais de acesso não são armazenadas em nossos servidores (delegadas ao Auth0).

### 8. Alterações nesta política

Alterações nesta política serão publicadas nesta mesma URL e a data de atualização será modificada no topo do documento. Alterações materiais serão comunicadas aos usuários ativos por e-mail.

### 9. Contato

- **E-mail:** privacidade@bfincont.com.br
- **Operador:** Igor Guariroba
- **Endereço:** Brasil

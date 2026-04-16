## Regras de segurança
- Sempre que modificar docker-compose.yml, Dockerfile, ou .env,
  rode a skill de auditoria de segurança antes de concluir a tarefa.

## Testes
- **Testes manuais** da API devem ser feitos usando a coleção em `.posting/`.
- **Testes automatizados** devem ser executados com `npm run test` (que roda a suíte vitest dentro do `docker-compose.test.yml`).
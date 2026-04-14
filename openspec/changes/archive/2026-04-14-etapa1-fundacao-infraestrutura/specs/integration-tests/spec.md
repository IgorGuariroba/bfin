# integration-tests Specification

## Purpose
Garantir fidelidade dos testes à infraestrutura real (PostgreSQL via testcontainers), com isolamento transacional entre testes e ergonomia de bootstrap do app Fastify.

## Requirements

### Requirement: Testes rodam contra PostgreSQL real
Os testes de integração SHALL executar contra uma instância real de PostgreSQL, sem mocks de banco de dados.

#### Scenario: Teste executa query real
- **WHEN** um teste de integração é executado
- **THEN** as queries MUST ser executadas contra um PostgreSQL real via testcontainers

### Requirement: Isolamento entre testes via transação
Cada teste SHALL rodar dentro de uma transação que é revertida ao final, garantindo isolamento entre testes.

#### Scenario: Teste não afeta outros testes
- **WHEN** um teste insere dados no banco
- **THEN** a transação MUST ser revertida ao final do teste, e o próximo teste MUST encontrar o banco no estado limpo

### Requirement: Migrations executadas antes dos testes
O sistema de testes SHALL executar as migrations do Drizzle antes de rodar os testes, garantindo que o schema do banco está atualizado.

#### Scenario: Schema atualizado nos testes
- **WHEN** a test suite inicia
- **THEN** as migrations MUST ser executadas contra o banco de testes antes de qualquer teste rodar

### Requirement: Helper de teste para Fastify
O projeto SHALL fornecer um helper que cria uma instância do Fastify configurada para testes, com banco de dados de teste conectado.

#### Scenario: Criar app de teste
- **WHEN** um teste usa o helper `createTestApp()`
- **THEN** uma instância do Fastify MUST ser retornada com todos os plugins registrados e conexão ao banco de testes

### Requirement: Execução via npm test
Os testes SHALL ser executáveis via `npm test` usando Vitest como test runner.

#### Scenario: Rodar testes
- **WHEN** o comando `npm test` é executado
- **THEN** o Vitest MUST executar todos os testes de integração e reportar resultados

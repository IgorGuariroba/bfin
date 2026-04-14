## Why

O projeto Financial Assistant API precisa de uma fundação sólida antes de qualquer feature de negócio. Sem a infraestrutura base (framework, banco, logging, padronização de erros, testes), cada feature subsequente seria construída sobre areia — sem consistência, sem rastreabilidade, sem confiança nas integrações.

## What Changes

- Setup do projeto Node.js com Fastify como framework HTTP, Drizzle ORM para acesso ao banco, e Pino para logging estruturado em JSON
- Docker Compose com serviços `api` e `db` (PostgreSQL 16) para desenvolvimento local
- Middleware de `requestId` que injeta um identificador único em todas as requests e o propaga nos logs
- Padronização de respostas de erro da API com estrutura consistente (`timestamp`, `requestId`, `message`, `code`) e códigos de erro de negócio definidos
- Infraestrutura de testes de integração com abordagem "No Mocks" — testes rodam contra PostgreSQL real via Docker, com seed por test suite e rollback transacional entre testes
- Estrutura de diretórios do projeto seguindo separação em camadas (routes, services, schemas, db)

## Capabilities

### New Capabilities
- `project-setup`: Configuração base do projeto — Fastify, Drizzle ORM, Pino, TypeScript, estrutura de diretórios
- `error-handling`: Padronização de respostas e erros da API com estrutura consistente e códigos de negócio
- `request-tracking`: Middleware de requestId para rastreabilidade de requests nos logs
- `docker-infra`: Docker Compose para desenvolvimento local com API + PostgreSQL
- `integration-tests`: Infraestrutura de testes de integração "No Mocks" com PostgreSQL real

### Modified Capabilities

## Impact

- Cria toda a estrutura do projeto a partir do zero (repositório vazio)
- Define dependências iniciais: fastify, drizzle-orm, drizzle-kit, pg, pino, typescript, vitest
- Estabelece Docker como requisito para desenvolvimento local e execução de testes
- Define o contrato de erro que todos os endpoints futuros devem seguir

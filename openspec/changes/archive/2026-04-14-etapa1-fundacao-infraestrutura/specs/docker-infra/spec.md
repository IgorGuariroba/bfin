# docker-infra Specification

## Purpose
Define os requisitos de containerização, composição de serviços de desenvolvimento e hardening operacional da infraestrutura Docker do projeto bfin.

## Requirements

### Requirement: Docker Compose para desenvolvimento
O projeto SHALL fornecer um `docker-compose.yml` com serviços `api` e `db` para desenvolvimento local.

#### Scenario: Subir ambiente completo
- **WHEN** o comando `docker compose up` é executado
- **THEN** os serviços `api` (porta 3000) e `db` (PostgreSQL 16) MUST iniciar e a API MUST conectar ao banco

#### Scenario: Persistência de dados do banco
- **WHEN** o container `db` é reiniciado
- **THEN** os dados MUST ser preservados via volume nomeado `pgdata`

### Requirement: Dockerfile multi-stage
O projeto SHALL fornecer um `Dockerfile` com build multi-stage: estágio de build (TypeScript → JavaScript) e estágio de runtime (apenas artefatos de produção).

#### Scenario: Build da imagem
- **WHEN** `docker build .` é executado
- **THEN** a imagem final MUST conter apenas `dist/`, `node_modules` de produção, e usar `node:22-alpine` como base

### Requirement: Variáveis de ambiente no Docker Compose
O Docker Compose SHALL configurar as variáveis de ambiente necessárias para a API: `DATABASE_URL`, `NODE_ENV`, `PORT`, carregadas via `env_file` (arquivo `.env`) — nunca hardcoded no `docker-compose.yml`.

#### Scenario: API conecta ao banco via Docker Compose
- **WHEN** os serviços sobem via `docker compose up`
- **THEN** a variável `DATABASE_URL` MUST apontar para o serviço `db` com credenciais carregadas do `.env`

#### Scenario: Exemplo de ambiente versionado
- **WHEN** o repositório é clonado
- **THEN** um arquivo `.env.example` MUST existir com as variáveis esperadas e valores de placeholder, e `.env` MUST estar no `.gitignore`

### Requirement: Segurança do container de runtime
O `Dockerfile` runtime SHALL executar o processo Node como usuário não-root.

#### Scenario: Container não roda como root
- **WHEN** o container da API é iniciado
- **THEN** o processo `node` MUST rodar sob o usuário `node` (já provido pela imagem `node:22-alpine`), configurado via diretiva `USER node` antes do `CMD`

### Requirement: Isolamento de rede entre serviços
O Docker Compose SHALL evitar expor portas internas ao host desnecessariamente.

#### Scenario: Porta do banco não é publicada
- **WHEN** `docker compose up` sobe os serviços
- **THEN** a porta `5432` do serviço `db` MUST NOT ser publicada no host — a comunicação API↔DB ocorre via rede interna do compose

#### Scenario: API acessível apenas localmente em dev
- **WHEN** a porta da API é publicada
- **THEN** o bind MUST ser em `127.0.0.1:3000:3000` para evitar exposição em todas as interfaces do host em ambiente de desenvolvimento

### Requirement: Disponibilidade e resiliência dos serviços
Os serviços do Docker Compose SHALL declarar healthcheck, política de restart e limites de recurso.

#### Scenario: Banco declara healthcheck e API só inicia quando pronto
- **WHEN** o serviço `db` sobe
- **THEN** um `healthcheck` baseado em `pg_isready` MUST existir, e o serviço `api` MUST usar `depends_on` com `condition: service_healthy`

#### Scenario: Política de restart definida
- **WHEN** qualquer serviço falha
- **THEN** ele MUST ser reiniciado automaticamente conforme `restart: unless-stopped`

#### Scenario: Limites de recurso configurados
- **WHEN** os serviços sobem
- **THEN** cada serviço MUST declarar `mem_limit` e `cpus` para evitar exaustão de recursos do host

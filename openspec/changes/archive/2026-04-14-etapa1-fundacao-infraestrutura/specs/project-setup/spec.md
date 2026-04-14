# project-setup Specification

## Purpose
Definir o bootstrap técnico do projeto: servidor Fastify, ORM, logger, estrutura de diretórios e scripts npm padronizados.

## Requirements

### Requirement: Fastify server bootstrap
O sistema SHALL inicializar um servidor Fastify com TypeScript, escutando na porta configurável via variável de ambiente `PORT` (default: 3000).

#### Scenario: Servidor inicia com sucesso
- **WHEN** o comando `npm run dev` é executado
- **THEN** o servidor Fastify inicia e responde a requests na porta configurada

#### Scenario: Health check endpoint
- **WHEN** uma request GET é enviada para `/health`
- **THEN** o sistema retorna status 200 com body `{ "status": "ok" }`

### Requirement: Drizzle ORM configurado com PostgreSQL
O sistema SHALL conectar ao PostgreSQL via Drizzle ORM usando a variável de ambiente `DATABASE_URL`.

#### Scenario: Conexão com o banco
- **WHEN** o servidor inicia com `DATABASE_URL` válida
- **THEN** o Drizzle ORM estabelece conexão com o PostgreSQL sem erros

#### Scenario: DATABASE_URL ausente
- **WHEN** o servidor inicia sem `DATABASE_URL` definida
- **THEN** o servidor MUST falhar no bootstrap com mensagem de erro clara indicando a variável ausente

### Requirement: Pino como logger padrão
O sistema SHALL usar Pino como logger integrado ao Fastify, produzindo logs estruturados em JSON.

#### Scenario: Logs em formato JSON
- **WHEN** qualquer request é processada
- **THEN** o log gerado MUST conter campos `level`, `time`, `reqId` e `msg` em formato JSON

### Requirement: Estrutura de diretórios do projeto
O projeto SHALL seguir a estrutura de diretórios definida no design, com separação entre `db/`, `plugins/`, `lib/`, e `routes/`.

#### Scenario: Estrutura criada
- **WHEN** o projeto é inicializado
- **THEN** os diretórios `src/db`, `src/plugins`, `src/lib`, `src/routes` MUST existir com seus arquivos base

### Requirement: Scripts npm padronizados
O projeto SHALL definir scripts npm para operações comuns.

#### Scenario: Scripts disponíveis
- **WHEN** o desenvolvedor consulta `package.json`
- **THEN** os scripts `dev`, `build`, `start`, `test`, `db:generate`, `db:migrate` MUST estar definidos

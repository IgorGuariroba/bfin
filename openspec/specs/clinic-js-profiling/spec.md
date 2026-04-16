## Purpose

Ferramentas de profiling de performance (CPU, event loop, heap) via Clinic.js com saída visual em navegador, integradas ao fluxo de desenvolvimento via Docker Compose.

## Requirements

### Requirement: Clinic.js devDependencies
O sistema SHALL ter `@clinic/doctor`, `@clinic/bubbleprof` e `@clinic/heapprofiler` como devDependencies no `package.json`.

#### Scenario: Instalação das dependências
- **WHEN** `npm install` é executado
- **THEN** os três pacotes do Clinic.js são instalados em `node_modules` e listados em `devDependencies`

### Requirement: Scripts npm de profiling
O sistema SHALL prover scripts npm `profile:doctor`, `profile:bubbleprof` e `profile:heap` que iniciam a aplicação com o profiler correspondente.

#### Scenario: CPU profiling com Doctor
- **WHEN** o desenvolvedor executa `npm run profile:doctor`
- **THEN** a aplicação inicia com `clinic doctor -- node dist/server.js`
- **AND** ao encerrar (SIGINT), um relatório HTML é gerado no diretório `.clinic/`

#### Scenario: Async profiling com Bubbleprof
- **WHEN** o desenvolvedor executa `npm run profile:bubbleprof`
- **THEN** a aplicação inicia com `clinic bubbleprof -- node dist/server.js`
- **AND** ao encerrar (SIGINT), um relatório HTML é gerado no diretório `.clinic/`

#### Scenario: Heap profiling com HeapProfiler
- **WHEN** o desenvolvedor executa `npm run profile:heap`
- **THEN** a aplicação inicia com `clinic heapprofiler -- node dist/server.js`
- **AND** ao encerrar (SIGINT), um relatório HTML é gerado no diretório `.clinic/`

### Requirement: Docker Compose override para profiling
O sistema SHALL prover um arquivo `docker-compose.profile.yml` que configura o container da aplicação para rodar com Clinic.js e monta o diretório `.clinic/` como volume bind.

#### Scenario: Execução com compose override
- **WHEN** `docker compose -f docker-compose.yml -f docker-compose.profile.yml up` é executado com a variável `CLINIC_TOOL=doctor`
- **THEN** o container da aplicação inicia com `clinic doctor -- node dist/server.js`
- **AND** o diretório `.clinic/` no container é mapeado para `.clinic/` no host

### Requirement: Output HTML acessível no host
O sistema SHALL gerar relatórios HTML acessíveis no filesystem do host para visualização no navegador.

#### Scenario: Relatório gerado após profiling
- **WHEN** uma sessão de profiling é encerrada normalmente
- **THEN** um diretório `.clinic/<tool>-<id>/` é criado no host contendo `index.html`
- **AND** o desenvolvedor pode abrir `index.html` no navegador para visualizar o profiling

### Requirement: Dockerfile de profiling
O sistema SHALL ter um Dockerfile (ou estágio no Dockerfile existente) que instale as devDependencies do Clinic.js para uso em container.

#### Scenario: Build da imagem de profiling
- **WHEN** a imagem Docker é construída com target `profile`
- **THEN** a imagem inclui as devDependencies do Clinic.js além das dependencies de produção

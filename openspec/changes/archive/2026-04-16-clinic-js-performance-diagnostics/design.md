## Context

O bfin é uma API Fastify/TypeScript que roda em Docker Compose com PostgreSQL. O fluxo de desenvolvimento usa `npm run dev` (docker compose up) e testes em container isolado. Atualmente não há nenhuma ferramenta de profiling — gargalos só são detectados por inspeção manual de logs ou métricas gerais.

O Clinic.js oferece três ferramentas:
- **Doctor**: CPU profiling + análise de I/O e event loop
- **Bubbleprof**: Visualização do fluxo de operações async
- **HeapProfiler**: Snapshot e diff de memória

Todas geram HTML visualizável no navegador.

## Goals / Non-Goals

**Goals:**
- Permitir profiling local de CPU, event loop e heap sem modificar código de produção
- Integração com o fluxo Docker existente
- Scripts npm simples para cada tipo de profiling
- Saída visual (HTML) para análise no navegador

**Non-Goals:**
- Profiling contínuo em produção (APM)
- Integração com CI/CD para benchmarks automáticos
- Instrumentação de código customizada (uso nativo do Clinic.js)

## Decisions

### 1. Instalar Clinic.js como devDependency

**Escolha**: Adicionar os 3 pacotes (`@clinic/doctor`, `@clinic/bubbleprof`, `@clinic/heapprofiler`) como devDependencies.

**Alternativa considerada**: Instalar globalmente. Descartada porque quebra reprodutibilidade entre desenvolvedores.

### 2. Profiling via Docker Compose override

**Escolha**: Criar `docker-compose.profile.yml` que sobrescreve o comando do container app para rodar via Clinic.js.

**Racional**: O app roda em Docker; o Clinic.js precisa ser executado **dentro** do container para coletar dados corretamente. O compose override mantém o compose principal limpo e permite `docker compose -f docker-compose.yml -f docker-compose.profile.yml up`.

**Alternativa considerada**: Montar volume com dados de saída. Incluída — o output HTML será montado como volume bind para acesso no host.

### 3. Scripts npm como entry point

**Escolha**: Criar scripts wrapper (`profile:doctor`, `profile:bubbleprof`, `profile:heap`) que iniciam o compose com o override correto.

**Racional**: Simplifica o comando para o desenvolvedor — `npm run profile:doctor` em vez de lembrar flags do docker compose.

## Risks / Trade-offs

- **[Performance overhead]** → Clinic.js adiciona overhead significativo ao processo. Usado apenas sob demanda, nunca em produção.
- **[Compatibilidade com Node.js]** → Clinic.js requer Node.js nativo (sem Alpine musl). O Dockerfile de profiling deve usar imagem `node:<version>-slim` ou `node:<version>`. Verificar compatibilidade com a imagem atual.
- **[Tamanho do output]** → Arquivos HTML podem crescer em apps com muitas rotas. Mitigado pelo fato de ser ferramenta sob demanda, não contínua.

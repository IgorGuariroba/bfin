## Context

O projeto bfin é uma API financeira em Node.js/TypeScript usando Fastify, Drizzle ORM e PostgreSQL. Atualmente possui:

- ESLint com `eslint-plugin-sonarjs` para análise local de bugs
- Vitest para testes automatizados via `docker-compose.test.yml`
- Nenhum pipeline CI/CD configurado (sem `.github/workflows/`)
- Sem geração de coverage reports

O time busca visibilidade contínua sobre qualidade de código, cobertura de testes e technical debt.

## Goals / Non-Goals

**Goals:**
- Configurar SonarCloud como ferramenta de análise contínua de qualidade
- Gerar coverage reports do Vitest em formato LCOV para envio ao SonarCloud
- Criar pipeline GitHub Actions que execute análise em cada PR e push no master
- Configurar `sonar-project.properties` com as exclusões adequadas

**Non-Goals:**
- Migrar de Vitest para Jest
- Configurar SonarQube self-hosted (usaremos SonarCloud SaaS)
- Implementar quality gates customizados complexos (usaremos o default do SonarCloud)
- Alterar a estrutura de testes existente

## Decisions

### 1. SonarCloud sobre SonarQube self-hosted
SonarCloud é gratuito para projetos open-source e não requer infraestrutura. O projeto pode ser público no GitHub sem riscos pois não contém dados sensíveis no código fonte.

**Alternativa**: SonarQube self-hosted exigiria infraestrutura adicional e manutenção.

### 2. Coverage provider: Istanbul (V8 coverage via Vitest)
O Vitest suporta nativamente coverage com `@vitest/coverage-istanbul` que gera relatórios LCOV, formato nativo do SonarCloud. Não é necessário usar `c8` ou `nyc` separadamente.

### 3. Pipeline: GitHub Actions com SonarCloud Scan Action
Usar a action oficial `SonarSource/sonarcloud-github-action` para simplificar a integração. O coverage será gerado antes do scan e enviado automaticamente.

### 4. Exclusões
Excluir `drizzle/` (migrations gerados), `dist/` (build output), e `tests/` da cobertura e análise de duplicação.

## Risks / Trade-offs

- **[Token exposto]** → Usar `SONAR_TOKEN` como GitHub Secret, nunca hardcode
- **[Coverage pode falhar no CI]** → Pipeline deve rodar testes com coverage antes do scan; se coverage falhar, scan roda sem coverage
- **[Tempo de análise]** → SonarCloud scan adiciona ~2-3 min ao pipeline → aceitável
- **[Projeto precisa ser público]** → Se projeto for privado, SonarCloud requer plano pago → verificar com o time

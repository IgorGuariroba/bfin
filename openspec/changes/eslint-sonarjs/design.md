## Context

O projeto bfin é uma API TypeScript/Fastify sem nenhuma ferramenta de lint configurada. Hoje a qualidade do código depende inteiramente de revisão manual. O TypeScript (`tsc --noEmit`) captura erros de tipo, mas não detecta code smells, lógica morta ou padrões problemáticos.

## Goals / Non-Goals

**Goals:**
- Configurar ESLint 9 com flat config para análise estática de todo código TypeScript
- Integrar regras do `eslint-plugin-sonarjs` para detectar bugs comuns e code smells
- Fornecer scripts `lint` e `lint:fix` para uso local e CI
- Garantir zero erros no código existente (configuração permissiva inicial se necessário)

**Non-Goals:**
- Formatação automática (Prettier) — fora do escopo
- Regras de estilo opinativas (airbnb, etc.) — apenas regras de correção/qualidade
- Configurar lint em editores/IDEs — cada dev configura seu ambiente
- Fixar todos os warnings existentes de uma vez — pode ser incremental

## Decisions

### 1. ESLint 9 com flat config
ESLint 9+ usa `eslint.config.js` (flat config) como padrão. Formato legado (`.eslintrc`) está deprecated.
- **Alternativa**: Usar `.eslintrc.js` legado — descartado por ser deprecated.

### 2. typescript-eslint (tseslint) ao invés de configurar parser+plugin separadamente
O pacote `typescript-eslint` agrupa parser e plugin com tipos compatíveis, reduzindo risco de mismatch de versão.
- **Alternativa**: `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` separados — mais verboso, mesma funcionalidade.

### 3. SonarJS apenas com regras de bug (não de code smell inicialmente)
O `eslint-plugin-sonarjs` tem dois grupos: `sonarjs` (bugs) e regras de code smell. Iniciaremos apenas com as regras de `recommended` (bugs críticos) para minimizar ruído no código existente.
- **Alternativa**: Habilitar todas as regras sonarjs — descartado por gerar muitos warnings de uma vez.

### 4. Ignorar `dist/` e arquivos gerados
Arquivos em `dist/` e `node_modules/` já são ignorados por padrão no flat config, mas adicionaremos `drizzle/` (migrações geradas) ao ignore.

## Risks / Trade-offs

- **[Risco]** Alguns false positives do SonarJS em padrões legítimos → Mitigação: desabilitar regras específicas via `// eslint-disable-next-line` ou comentário no config
- **[Trade-off]** Regras permissivas iniciais significam que nem todo problema será capturado → Mitigação: iterativamente adicionar mais regras conforme o time se familiariza

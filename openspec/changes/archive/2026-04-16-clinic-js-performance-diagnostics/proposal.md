## Why

O projeto não possui ferramentas de profiling de performance. À medida que a API cresce (transações, dívidas, metas, projeções), gargalos de CPU, event loop blocking e memory leaks podem surgir sem diagnósticos claros. O Clinic.js (do NearForm) é a ferramenta padrão da comunidade Node.js para profiling visual integrado ao fluxo de desenvolvimento.

## What Changes

- Adicionar Clinic.js como dependência de desenvolvimento (`@clinic/doctor`, `@clinic/bubbleprof`, `@clinic/heapprofiler`)
- Criar scripts npm para executar profiling local (`npm run profile:doctor`, `profile:bubbleprof`, `profile:heap`)
- Configurar integração com Docker Compose (perfil de desenvolvimento com Clinic.js instrumentando o container da aplicação)
- Adicionar documentação de uso dos profiling tools no README ou guia interno

## Capabilities

### New Capabilities
- `clinic-js-profiling`: Ferramentas de profiling de performance (CPU, event loop, heap) via Clinic.js com saída visual em navegador

### Modified Capabilities
<!-- Nenhuma capability existente será modificada em nível de requisito -->

## Impact

- **Dependências**: Novas devDependencies (`@clinic/doctor`, `@clinic/bubbleprof`, `@clinic/heapprofiler`)
- **Scripts**: Novos scripts em `package.json` para profiling
- **Docker**: Possível ajuste no `docker-compose.yml` ou novo compose override para profiling
- **Fluxo de dev**: Desenvolvedores podem rodar profiling local sem alterar código de produção

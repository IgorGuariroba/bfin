## 1. Corrigir IDOR nas tools MCP de transações

- [ ] 1.1 Adicionar `findTransactionById` nas tools `transactionsUpdate` e `transactionsDelete` para buscar o recurso antes da autorização
- [ ] 1.2 Usar o `contaId` real da transação encontrada em vez do `input.contaId` para chamar `authorizeToolCall`
- [ ] 1.3 Retornar `404 Not Found` se a transação não existir antes de checar autorização
- [ ] 1.4 Adicionar/atualizar testes em `tests/mcp-*.test.ts` para cobrir cenários de IDOR

## 2. Hardening do rate limiter MCP

- [ ] 2.1 Implementar classe `LruMap` com capacidade máxima de 10.000 entradas no `src/plugins/mcp-http.ts`
- [ ] 2.2 Substituir `Map` por `LruMap` no `rateBuckets`
- [ ] 2.3 Garantir que acesso a chave existente atualize a recência (LRU)
- [ ] 2.4 Adicionar testes para cenário de estouro de capacidade e remoção LRU

## 3. Hardening do pipeline CI/CD

- [ ] 3.1 Fixar `actions/checkout@v4` por SHA com comentário de versão em `.github/workflows/ci.yml`
- [ ] 3.2 Fixar `actions/setup-node@v4` por SHA com comentário em `.github/actions/setup-node-deps/action.yml`
- [ ] 3.3 Fixar `SonarSource/sonarcloud-github-action@master` por SHA com comentário em `.github/workflows/ci.yml`
- [ ] 3.4 Adicionar `permissions: contents: read` no topo do workflow `.github/workflows/ci.yml`
- [ ] 3.5 Adicionar `permissions: pull-requests: write` no job `coverage-sonar` se necessário para SonarCloud
- [ ] 3.6 Adicionar `timeout-minutes` em todos os jobs do workflow (lint, typecheck, test, coverage-sonar, build)

## 4. Documentação e testes

- [ ] 4.1 Rodar `npm run lint` e `npm run typecheck` localmente
- [ ] 4.2 Rodar `npm run test` para garantir que nenhum teste quebrou
- [ ] 4.3 Verificar se o CI passa em um push de teste (opcional)

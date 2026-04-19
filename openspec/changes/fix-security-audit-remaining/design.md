## Context

A auditoria de segurança identificou uma vulnerabilidade CRITICAL de SQL Injection em `src/services/category-service.ts:52`, onde a função `assertNoVinculos` concatena diretamente o `categoriaId` (input do usuário) em uma query SQL via `sql.raw`. Isso permite execução arbitrária de SQL no banco de dados.

Além disso, o pipeline CI/CD usa actions de terceiros com tags mutáveis (`@v4`, `@master`) e não restringe as permissões do `GITHUB_TOKEN`, expondo o repositório a riscos de supply chain.

## Goals / Non-Goals

**Goals:**
- Eliminar a SQL Injection em `category-service.ts` usando queries parametrizadas do Drizzle ORM.
- Fortalecer a cadeia de suprimento do CI/CD fixando actions por SHA.
- Reduzir a superfície de ataque do `GITHUB_TOKEN` com permissões mínimas.
- Prevenir jobs travados com timeouts explícitos.

**Non-Goals:**
- Não alterar a lógica de negócio de deleção de categorias.
- Não adicionar novas dependências ao projeto.
- Não modificar o comportamento funcional da API ou MCP.

## Decisions

### 1. Substituir `sql.raw` por query parametrizada do Drizzle
**Escolha:** Usar `db.select({ count: count() }).from(table).where(eq(column, categoriaId))` em vez de `sql.raw`.
**Rationale:** O Drizzle ORM já escapa valores automaticamente quando usa `eq()` e outros helpers. Isso elimina a SQL Injection sem introduzir novas dependências.
**Trade-off:** A função `assertNoVinculos` precisará fazer duas queries separadas (uma para `movimentacoes`, outra para `dividas`) em vez de um loop com `sql.raw`.

### 2. Pin de actions por SHA completo
**Escolha:** Fixar `actions/checkout`, `actions/setup-node` e `SonarSource/sonarcloud-github-action` para commits SHA específicos.
**Rationale:** Elimina o risco de tag mutável. O GitHub recomenda SHA para security hardening.
**Trade-off:** Atualizações manuais exigem buscar o SHA do release.

### 3. `permissions: contents: read` no workflow
**Escolha:** Definir `permissions: contents: read` no nível do workflow, adicionando permissões extras apenas onde necessário.
**Rationale:** O token padrão de write-all é desnecessário para a maioria dos jobs.
**Trade-off:** Se o SonarCloud precisar de `pull-requests: write`, será adicionado explicitamente.

## Risks / Trade-offs

- [Risco] Pin por SHA dificulta a manutenção de actions. → Mitigação: documentar no workflow como atualizar.
- [Risco] Query parametrizada pode ser mais lenta que `sql.raw` para operações simples. → Mitigação: diferença é insignificante para COUNT.

## Migration Plan

1. Merge do PR com as correções.
2. Verificar se o CI continua passando.
3. Deploy da imagem Docker atualizada.
4. Nenhuma migração de dados necessária.

## Open Questions

- O SonarCloud precisa de `pull-requests: write`? Verificar na documentação da action.

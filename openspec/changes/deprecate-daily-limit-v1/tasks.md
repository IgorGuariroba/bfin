## 1. Constante de sunset

- [ ] 1.1 Criar módulo `src/lib/deprecation.ts` (ou reaproveitar arquivo existente) exportando `DAILY_LIMIT_V1_SUNSET` como `const` em ISO 8601 UTC (`YYYY-MM-DDT00:00:00Z`), calculado como data do merge + 90 dias
- [ ] 1.2 Documentar no comentário do arquivo (1 linha) a regra "merge + 90 dias" e a change que definiu (`deprecate-daily-limit-v1`)

## 2. Headers de deprecação na rota v1

- [ ] 2.1 Em `src/routes/accounts.ts`, antes do `return` do handler `GET /contas/:contaId/limite-diario`, setar `Deprecation: true`
- [ ] 2.2 Setar header `Sunset: <DAILY_LIMIT_V1_SUNSET formatado como HTTP-date>` (RFC 7231 §7.1.1.1)
- [ ] 2.3 Setar header `Link: </contas/{contaId}/limite-diario-v2>; rel="successor-version"` (usar `contaId` real do path)
- [ ] 2.4 Garantir que erros (403, 404) NÃO recebem os headers de sucesso — apenas respostas `200 OK`

## 3. Testes da rota v1 atualizada

- [ ] 3.1 Adicionar cenário "Resposta inclui headers de deprecação" no teste da rota v1
- [ ] 3.2 Asserts: `response.headers['deprecation'] === 'true'`, `response.headers['sunset']` bate com a constante, `response.headers['link']` contém `rel="successor-version"`
- [ ] 3.3 Assert negativo: respostas 403 e 404 NÃO trazem header `Deprecation` nem `Sunset`
- [ ] 3.4 Cenários existentes (owner/viewer/sem vínculo/conta inexistente) MUST continuar passando sem modificação do payload

## 4. Descrições das tools MCP

- [ ] 4.1 Em `src/mcp/tools/daily-limit.ts`, atualizar `dailyLimitGet.description` para começar com `[DEPRECATED — use daily-limit_v2_get; sunset ${DAILY_LIMIT_V1_SUNSET_DATE}]` (valor interpolado como `YYYY-MM-DD`)
- [ ] 4.2 Atualizar `dailyLimitSet.description` para começar com `[DEPRECATED — use goals_create/goals_update; sunset ${DAILY_LIMIT_V1_SUNSET_DATE}]`
- [ ] 4.3 Expor `DAILY_LIMIT_V1_SUNSET_DATE` como variante string `YYYY-MM-DD` derivada da constante ISO

## 5. Testes das tools MCP

- [ ] 5.1 Cobrir asserção `description.startsWith("[DEPRECATED")` para `dailyLimitGet`
- [ ] 5.2 Cobrir asserção `description.startsWith("[DEPRECATED")` para `dailyLimitSet`
- [ ] 5.3 Cobrir que o handler continua funcional e retorna o mesmo payload (paridade com pré-deprecação)

## 6. Documentação

- [ ] 6.1 Em `docs/mcp.md`, marcar `daily-limit_get` e `daily-limit_set` como deprecated com a data de sunset e link para os substitutos
- [ ] 6.2 Destacar `daily-limit_v2_get` como caminho recomendado
- [ ] 6.3 Revisar `README.md` (raiz e `docs/`) para referências à rota v1 e atualizar apontando a v2
- [ ] 6.4 Nota explícita: `daily-limit_set` grava em `metas` via `upsertMeta`, que `porcentagem_reserva` não afeta o cálculo de limite diário, e que `goals_create`/`goals_update` são os substitutos reais

## 7. Spec

- [ ] 7.1 Confirmar que `openspec/changes/deprecate-daily-limit-v1/specs/daily-spending-limit/spec.md` usa MODIFIED para os 4 requirements v1 com nota de deprecação
- [ ] 7.2 Confirmar que o novo requirement "Deprecação das tools MCP v1" aparece em ADDED
- [ ] 7.3 Substituir placeholders `{{DAILY_LIMIT_V1_SUNSET}}` pela data real (ISO 8601) antes do merge do PR

## 8. Validação final

- [ ] 8.1 Rodar `npm run test` (suíte vitest via `docker-compose.test.yml`) e garantir todos os testes verdes
- [ ] 8.2 Rodar a coleção manual em `.posting/` via skill `run-manual-tests` confirmando que v1 continua funcional e que v2 também responde normalmente
- [ ] 8.3 Rodar `openspec validate deprecate-daily-limit-v1 --strict` e corrigir eventuais divergências
- [ ] 8.4 Confirmar que `add-daily-limit-v2` foi mergeado e deployado antes de abrir o PR desta change

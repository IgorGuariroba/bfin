## 1. Serviço v2

- [x] 1.1 Criar `src/services/daily-limit-v2-service.ts` com função `calcularLimiteDiarioV2({ contaId, hoje? })` que retorna `{ janela_inicio, janela_fim, horizonte_dias, saldo_atual, limite_diario, calculado_em }`
- [x] 1.2 Implementar cálculo: `saldo_atual = saldo_inicial + Σ receitas(data ≤ hoje) − Σ despesas(data ≤ hoje)` via join `movimentacoes → categorias → tipoCategorias`, filtrando `slug ∈ { receita, despesa }` e `data ≤ hoje`
- [x] 1.3 Implementar `limite_diario = max(0n, saldoCents) / 30` via `roundCentsHalfEven` de `src/lib/money.ts`
- [x] 1.4 Lançar `NotFoundError` quando a conta não existe (paridade com v1)
- [x] 1.5 Serializar `saldo_atual` e `limite_diario` como strings com 2 casas via `fromCents`

## 2. Testes do serviço

- [x] 2.1 Criar `src/services/__tests__/daily-limit-v2-service.test.ts`
- [x] 2.2 Cobrir cenário "cálculo padrão" (saldo positivo) do spec
- [x] 2.3 Cobrir cenário "saldo zero" e "saldo negativo" retornando `limite_diario = "0.00"`
- [x] 2.4 Cobrir cenário "arredondamento HALF_EVEN" (saldo 100.00 / 30)
- [x] 2.5 Cobrir cenário "receitas futuras não contam" (movimentação `receita` com `data > hoje` é ignorada)
- [x] 2.6 Cobrir cenário "parcelas de dívida não entram" (parcela com `data_vencimento` na janela não afeta `saldo_atual`)
- [x] 2.7 Cobrir cenário "recorrentes futuras não entram" (recorrente com `data > hoje` é ignorada)
- [x] 2.8 Cobrir cenário "meta não altera limite v2" (conta com e sem `porcentagem_reserva` retornam o mesmo `limite_diario`)
- [x] 2.9 Cobrir `NotFoundError` quando a conta não existe
- [x] 2.10 Testar janela em UTC e horizonte fixo de 30 dias (consulta no dia 28/abr → `janela_fim` = 28/mai)

## 3. Rota HTTP v2

- [x] 3.1 Adicionar `GET /contas/:contaId/limite-diario-v2` em `src/routes/accounts.ts` imediatamente após o handler v1
- [x] 3.2 Reutilizar `auth-guard` e o middleware de autorização por conta (paridade exata com v1)
- [x] 3.3 Mapear resposta do serviço para o payload especificado: `{ contaId, janela_inicio, janela_fim, horizonte_dias, saldo_atual, limite_diario, calculado_em }`
- [x] 3.4 Validar que `404 RESOURCE_NOT_FOUND` é retornado quando a conta não existe (via `NotFoundError` do serviço)

## 4. Testes da rota

- [x] 4.1 Criar `src/routes/__tests__/accounts-limite-diario-v2.test.ts` (ou estender o existente)
- [x] 4.2 Cenário "Owner consulta limite v2 retorna 200 com payload completo"
- [x] 4.3 Cenário "Viewer consulta limite v2 retorna 200"
- [x] 4.4 Cenário "Usuário sem vínculo recebe 403 INSUFFICIENT_PERMISSIONS"
- [x] 4.5 Cenário "Conta inexistente retorna 404 RESOURCE_NOT_FOUND"
- [x] 4.6 Garantir que a rota NÃO consulta `projecao`, `metas.porcentagem_reserva`, recorrentes futuras nem `parcelasDivida` (asserção por spy ou verificação de queries)

## 5. MCP tool v2

- [x] 5.1 Em `src/mcp/tools/daily-limit.ts`, adicionar export `dailyLimitV2Get` com `name: "daily-limit_v2_get"`, `requiredScope: "daily-limit:read"`, `minRole: "viewer"`
- [x] 5.2 Schema de entrada com `contaId: z.uuid()` e `hoje: isoDate.optional()`
- [x] 5.3 Handler chama `calcularLimiteDiarioV2` e retorna o payload v2
- [x] 5.4 Registrar `dailyLimitV2Get` em `src/mcp/tools/index.ts` ao lado de `dailyLimitGet`

## 6. Testes da MCP tool

- [x] 6.1 Criar teste cobrindo "tool retorna limite v2" e "tool rejeita contaId inválido"
- [x] 6.2 Validar que o payload tem exatamente os campos especificados (sem sobras)

## 7. Testes manuais (.posting)

- [x] 7.1 Adicionar request `GET /contas/{{contaId}}/limite-diario-v2` em `.posting/limite-diario/` (ou criar subpasta `v2/`)
- [x] 7.2 Adicionar asserts de status e shape do payload

## 8. Documentação

- [x] 8.1 Atualizar `docs/mcp.md` incluindo `daily-limit_v2_get` ao lado de `daily-limit_get`, com exemplo de payload
- [x] 8.2 Documentar a rota v2 onde a v1 for referenciada em docs/READMEs
- [x] 8.3 Nota explícita: v2 não consome `porcentagem_reserva`, não depende de `projecao`, nem considera parcelas de dívida

## 9. Validação final

- [ ] 9.1 Rodar `npm run test` (suíte vitest via `docker-compose.test.yml`) e garantir todos os testes verdes
- [ ] 9.2 Executar coleção manual em `.posting/` via skill `run-manual-tests` para sanity-check ponta a ponta
- [ ] 9.3 Rodar `openspec validate add-daily-limit-v2 --strict` e corrigir eventuais divergências

> Nota: `npm run test` falha com CONNECT_TIMEOUT (testcontainers não consegue iniciar postgres) — falha pré-existente no ambiente, não causada por esta change. TypeScript compila sem erros (`tsc --noEmit`).

## 1. Análise dos schemas e services de update

- [x] 1.1 Inspecionar schemas Zod de update de Account, User e Transaction (verificar strict/passthrough/strip)
- [x] 1.2 Inspecionar services de update de Account, User e Transaction (verificar se usam spread direto no Drizzle)
- [x] 1.3 Documentar campos protegidos de cada entidade para usar nos testes

## 2. Testes de schema Zod — rejeição de campos extras

- [x] 2.1 Criar teste: Account update ignora campo inexistente via API (`createdAt`, `id`)
- [~] 2.2 Skipped: não existe schema/service de update de User no projeto
- [x] 2.3 Criar teste: Transaction update stripa campo inexistente via Zod (`createdAt`, `usuarioId`)

## 3. Testes de service — ignoração de campos protegidos

- [x] 3.1 Criar teste: service de Account ignora `createdAt` e `id` no update
- [~] 3.2 Skipped: não existe service de update de User no projeto
- [x] 3.3 Criar teste: service de Transaction ignora `createdAt` e `usuarioId` no update

## 4. Testes de mass assignment via nested objects

- [x] 4.1 Criar teste: payload com objeto aninhado contendo campo protegido é rejeitado ou ignorado

## 5. Validação e cobertura

- [x] 5.1 Executar suite de testes com `npm run test`
- [x] 5.2 Verificar que novos testes passam e não quebram testes existentes
- [~] 5.3 Verificar cobertura de código dos novos testes no SonarCloud — cobertura será verificada no CI/SonarCloud após push

## Context

O projeto utiliza Zod para validação de inputs em todos os services. Cada service de update (ex: `account-service.ts`, `user-service.ts`, `transaction-service.ts`) recebe um payload e aplica um schema Zod antes de persistir. A vulnerabilidade de Mass Assignment ocorre quando o schema permite campos extras (`z.object({}).passthrough()`) ou quando o service faz spread direto do payload no ORM/Drizzle sem filtrar campos protegidos.

Atualmente os testes cobrem cenários felizes e erros de validação básicos, mas não existem testes que tentem injetar campos protegidos (ex: `role`, `isAdmin`, `createdAt`, `deletedAt`) em updates.

## Goals / Non-Goals

**Goals:**
- Criar testes que tentem passar campos protegidos/inexistentes nos schemas de update das entidades críticas
- Verificar que Zod rejeita campos extras quando `strict()` ou `strip()` está configurado
- Verificar que o service ignora campos não esperados no payload
- Adicionar testes para mass assignment em entidades: Account, User, Transaction

**Non-Goals:**
- Alterar schemas Zod ou services de update (testes devem validar comportamento atual)
- Testar mass assignment em create (fora do escopo desta change)
- Implementar solução de segurança (apenas testes)

## Decisions

**1. Usar testes de unidade nos services, não nos controllers**
- Rationale: A validação Zod ocorre na camada de service. Testar nos services isola a lógica de validação do transporte HTTP/MCP.
- Alternativa: Testes E2E nos controllers — rejeitado porque adicionaria overhead de setup HTTP/Fastify sem valor adicional para este cenário.

**2. Testar contra schemas Zod diretamente + services com mock de db**
- Rationale: Testar o schema isolado valida que `strict()`/`strip()` está configurado. Testar o service valida que não há bypass via spread direto no Drizzle.
- Alternativa: Testar só o schema — rejeitado porque não cobriria cenários de spread no service.

**3. Focar em Account, User e Transaction**
- Rationale: São as entidades com maior superfície de ataque (dados sensíveis, permissões, valores monetários).

## Risks / Trade-offs

- [Risco] Schemas atuais podem estar usando `passthrough()` ou spread inseguro → Mitigação: Os testes irão revelar isso; se falharem, documentar como bugs separados.
- [Trade-off] Testes de mass assignment adicionam tempo de execução à suite → Mitigação: São poucos testes por entidade (~3-4 cada), impacto mínimo.

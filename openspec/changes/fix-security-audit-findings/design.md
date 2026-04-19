## Context

A auditoria de segurança identificou 4 findings HIGH e 4 MEDIUM na API HTTP, MCP HTTP, CI/CD e Docker Compose. Os dois findings HIGH de código são IDORs no MCP onde tool handlers confiam no `contaId` do input para autorização, mas operam sobre um `id` de recurso que pode pertencer a outra conta. Os findings HIGH de infraestrutura são supply chain risks no CI/CD.

## Goals / Non-Goals

**Goals:**
- Eliminar vetores de IDOR nas tools MCP `transactions.delete` e `transactions.update`.
- Proteger o rate limiter em memória do MCP contra estouro de memória via chaves arbitrárias.
- Fortalecer a cadeia de suprimento do CI/CD fixando actions por SHA e restringindo permissões.
- Documentar claramente os riscos do `docker-compose.test.yml`.

**Non-Goals:**
- Não alterar a arquitetura de autorização da API HTTP (já valida corretamente).
- Não migrar o rate limiter para Redis (fora do escopo; apenas hardening do LRU).
- Não remover o mount do Docker socket no compose de testes (necessário para testcontainers).
- Não alterar comportamento funcional das tools MCP além da correção de segurança.

## Decisions

### 1. Resolver IDOR buscando o recurso antes da autorização
**Escolha:** Nas tools `transactions.update` e `transactions.delete`, buscar a transação pelo `id` antes de chamar `authorizeToolCall`, extrair o `contaId` real do recurso e usá-lo para autorização.
**Rationale:** Reutiliza a lógica existente de `findTransactionById` e `assertAccountRole` sem introduzir novos conceitos. A alternativa (validar no service layer) seria mais profunda e afetaria também a API HTTP, que já está correta.
**Trade-off:** Custo de uma query extra por operação (aceitável para correção de segurança).

### 2. LRU com limite de 10.000 entradas no rate limiter MCP
**Escolha:** Substituir o `Map` simples por um LRU (Least Recently Used) com capacidade máxima de 10.000 entradas.
**Rationale:** Previne DoS de memória sem depender de infraestrutura externa. 10.000 é um limite conservador que cobre picos razoáveis de sessões/IPs distintos.
**Trade-off:** Em cenários de ataque massivo com >10.000 chaves únicas, entradas legítimas podem ser expulsas. Isso é aceitável pois o rate limiter é uma camada de mitigação, não de garantia.

### 3. Pin de actions por SHA completo
**Escolha:** Fixar `actions/checkout`, `actions/setup-node` e `SonarSource/sonarcloud-github-action` para commits SHA específicos, usando comentários com a versão legível.
**Rationale:** Elimina o risco de tag mutável. O GitHub recomenda SHA para security hardening.
**Trade-off:** Atualizações manuais de actions exigem buscar o SHA do release desejado.

### 4. `permissions: contents: read` no workflow
**Escolha:** Definir `permissions: contents: read` no nível do workflow, adicionando `pull-requests: write` apenas no job `coverage-sonar` se necessário para o SonarCloud.
**Rationale:** O token padrão de write-all é desnecessário para a maioria dos jobs (lint, typecheck, test, build).
**Trade-off:** Se o SonarCloud precisar de permissões adicionais, serão adicionadas explicitamente.

## Risks / Trade-offs

- [Risco] Adicionar query extra nas tools MCP pode aumentar latência em 1-2ms por chamada. → Mitigação: cache local não é necessário pois o volume é baixo; se tornar problema, pode-se otimizar depois.
- [Risco] Pin por SHA dificulta a manutenção de actions. → Mitigação: documentar no `ci.yml` como atualizar (buscar SHA no release do GitHub).
- [Risco] LRU pode expulsar chaves legítimas sob ataque. → Mitigação: monitorar métricas de `mcp_auth_failures_total` e `mcp_rate_limit_hits`; se necessário, aumentar capacidade ou migrar para Redis.

## Migration Plan

1. Merge do PR com as correções.
2. Verificar se o CI continua passando (lint, typecheck, test, build, SonarCloud).
3. Deploy da imagem Docker atualizada.
4. Nenhuma migração de dados necessária.

## Open Questions

- O SonarCloud precisa de `pull-requests: write` para postar comentários? Verificar na documentação da action.

# mcp-rate-limiter-hardening Specification

## Purpose

Proteger o rate limiter em memória do MCP HTTP contra estouro de memória causado por acumulação de chaves arbitrárias (IPs ou subjects).

## ADDED Requirements

### Requirement: Rate limiter com limite de capacidade
O rate limiter em memória do MCP HTTP SHALL usar uma estrutura LRU (Least Recently Used) com capacidade máxima de 10.000 entradas. Quando a capacidade é excedida, a entrada menos recentemente acessada SHALL ser removida antes da inserção da nova.

#### Scenario: Inserção dentro do limite
- **WHEN** o rate limiter recebe uma nova chave e o total de entradas é menor que 10.000
- **THEN** a entrada é criada normalmente com contador e tempo de reset

#### Scenario: Inserção acima do limite
- **WHEN** o rate limiter recebe uma nova chave e já possui 10.000 entradas
- **THEN** a entrada menos recentemente usada é removida e a nova entrada é inserida

#### Scenario: Acesso atualiza recência
- **WHEN** uma chave existente é verificada pelo rate limiter
- **THEN** essa chave é marcada como recentemente usada, dificultando sua remoção

### Requirement: Rate limiter não afeta funcionalidade legítima
O rate limiter LRU SHALL manter o comportamento de janela deslizante: se `now > bucket.resetAt`, o bucket é recriado com contador zerado, independentemente de ter sido removido ou não por LRU.

#### Scenario: Bucket removido por LRU e recriado
- **WHEN** uma chave foi removida por LRU e uma nova requisição chega após o `resetAt` original
- **THEN** um novo bucket é criado com contador 1 e novo `resetAt`, sem erro

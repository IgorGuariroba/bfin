## ADDED Requirements

### Requirement: Interface única de session store
O sistema SHALL definir uma interface `SessionStore` em `src/mcp/session-store.ts` com operações mínimas `create(sessionId, data)`, `get(sessionId)`, `touch(sessionId)`, `delete(sessionId)`, `list()`. Todas as implementações concretas SHALL respeitar essa interface.

#### Scenario: Plugin consome interface, não implementação
- **WHEN** o plugin `mcp-http.ts` resolve o store via DI
- **THEN** o código do plugin não importa nenhuma implementação concreta (Redis ou memory), apenas a interface

### Requirement: Implementação in-memory como default de desenvolvimento
O sistema SHALL fornecer `InMemorySessionStore` implementada sobre `Map<string, SessionData>` com TTL configurável (default 1h de idle). Esta é a implementação usada quando `MCP_SESSION_STORE=memory` ou quando a variável não está definida.

#### Scenario: Sessão expira por idle
- **WHEN** uma sessão é criada e não sofre `touch` por 1h
- **THEN** o próximo `get(sessionId)` retorna `null` e a entrada é removida do Map

#### Scenario: Restart do processo perde sessões
- **WHEN** o processo Fastify reinicia com `MCP_SESSION_STORE=memory`
- **THEN** todas as sessões ativas são perdidas — clientes precisam refazer handshake (aceitável em dev)

### Requirement: Implementação Redis para produção
O sistema SHALL fornecer `RedisSessionStore` em `src/mcp/session-store-redis.ts` persistindo cada sessão em chave `mcp:session:<sessionId>` com TTL igual ao idle timeout. A implementação SHALL reutilizar o cliente Redis já presente no compose (`bfin-redis-1`, `REDIS_URL=redis://redis:6379`). Seleção via `MCP_SESSION_STORE=redis`.

#### Scenario: Sessão sobrevive a restart
- **WHEN** uma sessão é criada em prod, o processo reinicia (deploy), o cliente envia request com mesmo `Mcp-Session-Id`
- **THEN** o store lê a chave de Redis e retorna os dados — o handshake não precisa ser refeito

#### Scenario: TTL renovado em touch
- **WHEN** uma sessão existe em Redis e recebe `touch(sessionId)`
- **THEN** o TTL da chave é renovado para o valor configurado (ex.: 3600s)

#### Scenario: Redis indisponível no bootstrap
- **WHEN** `MCP_SESSION_STORE=redis` e `REDIS_URL` aponta para host inalcançável
- **THEN** o bootstrap do Fastify falha com erro claro (`Redis connection failed`) — não faz fallback silencioso pra memory

### Requirement: Seleção por variável de ambiente
O sistema SHALL selecionar a implementação via `MCP_SESSION_STORE` com valores permitidos `"memory"` (default) e `"redis"`. Qualquer outro valor SHALL causar falha no bootstrap com mensagem descrevendo as opções válidas.

#### Scenario: Valor válido
- **WHEN** `MCP_SESSION_STORE=redis` e `REDIS_URL` definido
- **THEN** o plugin registra `RedisSessionStore` no container de DI

#### Scenario: Valor inválido
- **WHEN** `MCP_SESSION_STORE=postgres`
- **THEN** o bootstrap falha com mensagem `Invalid MCP_SESSION_STORE. Expected "memory" or "redis"`

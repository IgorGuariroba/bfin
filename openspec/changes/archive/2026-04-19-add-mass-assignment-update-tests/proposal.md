## Why

O sistema possui endpoints de update que podem estar vulneráveis a Mass Assignment, onde um atacante pode enviar campos não autorizados (ex: `role`, `balance`, `isAdmin`) para modificar atributos protegidos. Precisamos de testes automatizados que simulem esses ataques para garantir que os services e schemas de validação estão corretamente protegidos.

## What Changes

- Adicionar testes automatizados que simulem tentativas de Mass Assignment em operações de update de entidades críticas (ex: Account, User, Transaction).
- Verificar que campos protegidos não são aceitos no input de update.
- Garantir que o schema de validação (Zod) rejeite campos extras não permitidos.
- Criar testes para cenários: campos inexistentes, campos existentes mas protegidos, nested objects com campos protegidos.

## Capabilities

### New Capabilities
- `mass-assignment-update-tests`: Testes automatizados que simulam ataques de Mass Assignment em endpoints de update, validando que apenas campos permitidos são processados.

### Modified Capabilities
- *(nenhum — esta change adiciona apenas testes, não altera requisitos de funcionalidades existentes)*

## Impact

- Suite de testes automatizados (Vitest)
- Services de update (`src/services/*`) — testados mas não modificados
- Schemas Zod de validação de input — testados mas não modificados

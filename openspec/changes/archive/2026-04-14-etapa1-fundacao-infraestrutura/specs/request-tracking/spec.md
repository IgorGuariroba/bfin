# request-tracking Specification

## Purpose
Garantir rastreabilidade de cada request HTTP por um `requestId` único, propagado em logs e respostas de erro, com respeito a IDs vindos do cliente.

## Requirements

### Requirement: RequestId gerado para toda request
O sistema SHALL gerar um identificador único (`requestId`) para cada request HTTP recebida, no formato `req-<uuid>`.

#### Scenario: Request sem header X-Request-Id
- **WHEN** uma request é recebida sem header `X-Request-Id`
- **THEN** o sistema MUST gerar um `requestId` único no formato `req-<uuid>` e propagá-lo nos logs

#### Scenario: Request com header X-Request-Id
- **WHEN** uma request é recebida com header `X-Request-Id: client-abc-123`
- **THEN** o sistema MUST usar o valor `client-abc-123` como `requestId`

### Requirement: RequestId propagado nos logs
O `requestId` SHALL ser automaticamente incluído em todos os logs Pino gerados durante o processamento de uma request.

#### Scenario: Log de request contém requestId
- **WHEN** uma request é processada e gera logs
- **THEN** cada entrada de log MUST conter o campo `reqId` com o valor do `requestId` da request

### Requirement: RequestId incluído em respostas de erro
Todas as respostas de erro SHALL incluir o `requestId` no body JSON, conforme a estrutura padrão de erro.

#### Scenario: Erro retorna requestId
- **WHEN** uma request resulta em erro
- **THEN** o body de erro MUST conter o campo `requestId` com o valor gerado/recebido para aquela request

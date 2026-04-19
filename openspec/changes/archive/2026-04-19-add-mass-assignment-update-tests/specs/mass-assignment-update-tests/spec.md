## ADDED Requirements

### Requirement: Schema de update rejeita campos extras
O schema Zod de update de uma entidade SHALL rejeitar campos que não fazem parte do schema definido quando configurado como strict.

#### Scenario: Campo inexistente é rejeitado no update de Account
- **WHEN** um payload de update de Account contém um campo não definido no schema (ex: `isAdmin: true`)
- **THEN** o schema Zod deve rejeitar o input com erro de validação

#### Scenario: Campo inexistente é rejeitado no update de User
- **WHEN** um payload de update de User contém um campo não definido no schema (ex: `role: "admin"`)
- **THEN** o schema Zod deve rejeitar o input com erro de validação

#### Scenario: Campo inexistente é rejeitado no update de Transaction
- **WHEN** um payload de update de Transaction contém um campo não definido no schema (ex: `userId: "outro-id"`)
- **THEN** o schema Zod deve rejeitar o input com erro de validação

### Requirement: Service de update ignora campos protegidos
O service de update de uma entidade SHALL garantir que campos protegidos não sejam persistidos, mesmo que bypassem a validação do schema.

#### Scenario: Service de Account ignora campo protegido
- **WHEN** o service de update de Account recebe um payload contendo um campo protegido (ex: `createdAt`, `deletedAt`)
- **THEN** o campo protegido não deve ser incluído na query de update do banco de dados

#### Scenario: Service de User ignora campo protegido
- **WHEN** o service de update de User recebe um payload contendo um campo protegido (ex: `passwordHash`, `emailVerifiedAt`)
- **THEN** o campo protegido não deve ser incluído na query de update do banco de dados

#### Scenario: Service de Transaction ignora campo protegido
- **WHEN** o service de update de Transaction recebe um payload contendo um campo protegido (ex: `createdAt`, `reconciledAt`)
- **THEN** o campo protegido não deve ser incluído na query de update do banco de dados

### Requirement: Testes cobrem mass assignment via nested objects
Os testes SHALL cobrir cenários onde campos protegidos são enviados dentro de objetos aninhados no payload de update.

#### Scenario: Objeto aninhado com campo protegido é rejeitado ou ignorado
- **WHEN** um payload de update contém um objeto aninhado com campos protegidos
- **THEN** o sistema deve rejeitar o input ou garantir que os campos protegidos não sejam persistidos

# Financial Assistant API — MVP (v2)

> Motor de previsão financeira para contas compartilhadas com rastreabilidade de transações, recálculo dinâmico de projeções e indicadores de saúde patrimonial.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura e Stack Técnica](#2-arquitetura-e-stack-técnica)
3. [Autenticação e Autorização](#3-autenticação-e-autorização)
4. [Modelo de Dados](#4-modelo-de-dados)
5. [Contrato de Rotas da API](#5-contrato-de-rotas-da-api)
6. [Regras de Negócio](#6-regras-de-negócio)
7. [Motor de Projeção e Indicador de Reserva](#7-motor-de-projeção-e-indicador-de-reserva)
8. [Sistema de Eventos e Recálculo](#8-sistema-de-eventos-e-recálculo)
9. [Infraestrutura e DevOps](#9-infraestrutura-e-devops)
10. [Padronização de Respostas e Erros](#10-padronização-de-respostas-e-erros)

---

## Changelog v2

| Ponto | Mudança |
|-------|---------|
| Autenticação | Removido campo `password` do modelo. Identidade 100% delegada ao provedor OIDC |
| Cluster + Eventos | Adicionado `recalculado_em` e `status` na projeção persistida para sinalizar freshness |
| Projeção em cascata | Definida estratégia lazy com cache — calcula meses anteriores sob demanda se necessário |
| DELETE de movimentações | Adicionada rota `DELETE /movimentacoes/{id}` |
| DELETE de dívidas | Adicionada rota `DELETE /dividas/{id}` (apenas se nenhuma parcela foi paga) |
| Recorrência | Removida expiração de 12 meses. Recorrência é indefinida até cancelamento explícito ou data limite |
| Meta de reserva | Esclarecido que é decisão coletiva da conta, não individual. Renomeado de "meta de poupança" para "meta de reserva de emergência" |
| Nomenclatura | "Semáforo Financeiro" renomeado para "Indicador de Reserva". Campo `semaforo` renomeado para `indicador_reserva` nos payloads JSON |
| Saldo inicial | Adicionado campo `saldo_inicial` na entidade Conta e rota para defini-lo |

---

## 1. Visão Geral

### Propósito

A API vai além de um CRUD financeiro tradicional. Funciona como um **motor de inferência** que processa movimentações (fixas, variáveis, recorrentes ou esporádicas) e calcula o impacto no fluxo de caixa futuro.

### Princípios Fundamentais

- **Contas compartilhadas como unidade central**: múltiplos usuários visualizam o impacto coletivo de suas decisões financeiras.
- **Rastreabilidade total**: toda operação é auditável via `requestId` e `userId` extraído do token.
- **Recálculo orientado a eventos**: toda mutação em movimentações ou metas emite eventos que disparam recálculo da projeção.
- **Projeção diária**: o sistema gera um array dia-a-dia de saúde financeira (Indicador de Reserva).
- **Espelho da realidade**: o sistema nunca esconde informações desfavoráveis. Se a situação financeira é insustentável, os indicadores refletem isso sem travas artificiais.

---

## 2. Arquitetura e Stack Técnica

### Stack Principal

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Runtime | Node.js | Ecossistema maduro, I/O não-bloqueante |
| Framework | Fastify | Baixa latência, schema validation nativo, hooks nativos para eventos |
| Banco de Dados | PostgreSQL | ACID, suporte robusto a tipos numéricos financeiros |
| ORM | Drizzle ORM | Type-safe, abordagem "No Mocks" em testes |
| Containerização | Docker | API + Banco containerizados |
| Process Manager | PM2 (Cluster Mode) | Auto-restart, monitoramento de memória |
| Logging | Pino | Logs estruturados em JSON, `requestId` injetado em todos os fluxos |
| Diagnóstico | Clinic.js | Doctor, Flame e Bubbleprof para análise de CPU e event loop |

### Integração MCP

A API expõe suporte ao **Model Context Protocol (MCP)** via STDIO e JSON-RPC, permitindo que a camada de serviços seja consumida por agentes inteligentes ou interfaces programáticas externas.

### Diagrama de Camadas

```
┌──────────────────────────────────────────────────────┐
│                      Clientes                         │
│           (App Mobile / Web / Agente MCP)             │
└───────────────────┬──────────────────────────────────┘
                    │ HTTPS / STDIO (MCP)
┌───────────────────▼──────────────────────────────────┐
│                Fastify (API Gateway)                  │
│  ┌─────────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │  Auth Guard  │  │   RBAC   │  │   Pino Logger   │  │
│  │   (OIDC)    │  │ Middleware│  │   (requestId)   │  │
│  └─────────────┘  └──────────┘  └─────────────────┘  │
├──────────────────────────────────────────────────────┤
│                Camada de Serviços                      │
│  ┌────────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │ Usuários   │ │ Movimentações│ │   Motor de      │  │
│  │ & Contas   │ │ Metas        │ │   Projeção      │  │
│  │            │ │ & Dívidas    │ │                 │  │
│  └────────────┘ └──────┬───────┘ └────────▲────────┘  │
│                        │  EventEmitter     │           │
│                        └───────────────────┘           │
├──────────────────────────────────────────────────────┤
│            Drizzle ORM + PostgreSQL                    │
└──────────────────────────────────────────────────────┘
```

---

## 3. Autenticação e Autorização

### Protocolo

- **OAuth2 + OpenID Connect (OIDC)** para gestão de identidade.
- **A API não armazena senhas.** Toda autenticação é delegada ao provedor de identidade (ex: Google, Auth0, Keycloak).
- **Bearer Token** via header `Authorization`.
- Validação implementada com a biblioteca `openid-client`.
- Dados do usuário (`userId`, claims) são extraídos automaticamente do token para auditoria.

**Fluxo de primeiro acesso:**
1. Usuário se autentica no provedor OIDC (ex: tela de login do Google).
2. Frontend recebe o `id_token` e o envia como Bearer Token.
3. A API valida o token com a chave pública do provedor.
4. Se o `sub` (subject) do token não existe no banco, a API cria automaticamente o registro `Usuario` com `nome` e `email` extraídos das claims.
5. Requests subsequentes utilizam o mesmo fluxo — token validado, `userId` extraído.

### Modelo de Papéis

O sistema possui dois níveis de acesso:

#### Papéis Globais (nível de sistema)

| Papel | Escopo |
|-------|--------|
| `admin` | Gerenciamento de categorias do sistema. Não vinculado a contas financeiras. |

#### Papéis por Conta Financeira (RBAC contextual)

| Papel | Permissões | Escopo |
|-------|-----------|--------|
| `owner` | Leitura + Escrita | Registrar movimentações, gerenciar membros, configurar metas, deletar recursos |
| `viewer` | Leitura | Consultar movimentações e projeções. Tentativas de `POST`, `PUT` ou `DELETE` retornam `403 Forbidden` |

**Regras de atribuição:**
- O criador de uma conta é automaticamente `owner`.
- Novos membros são associados via `POST /contas/{contaId}/usuarios` (restrito a `owner`).
- O papel `admin` é atribuído no nível do sistema, independente de contas financeiras.

---

## 4. Modelo de Dados

### Entidades Principais

#### Usuário

```
Usuario {
  id              UUID (PK)
  id_provedor     VARCHAR UNIQUE NOT NULL  -- "sub" do token OIDC
  nome            VARCHAR NOT NULL
  email           VARCHAR UNIQUE NOT NULL
  is_admin        BOOLEAN DEFAULT false
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
}
```

**Nota:** Não há campo `password`. A identidade é inteiramente gerida pelo provedor OIDC. O campo `id_provedor` armazena o identificador único do usuário no provedor (`sub` claim do token), permitindo reconciliação entre tokens e registros internos.

#### Categoria (gerenciada por admin)

```
Categoria {
  id                UUID (PK)
  nome              VARCHAR NOT NULL
  tipo_categoria_id UUID (FK -> TipoCategoria.id)
  created_at        TIMESTAMP
  updated_at        TIMESTAMP

  UNIQUE(nome, tipo_categoria_id)
}
```

#### Tipo de Categoria
```
TipoCategoria {
  id          UUID (PK)
  slug        VARCHAR UNIQUE NOT NULL -- ex: 'receita', 'despesa', 'divida'
  nome        VARCHAR NOT NULL
  created_at  TIMESTAMP
  updated_at  TIMESTAMP
}
```

#### Conta Financeira

```
Conta {
  id              UUID (PK)
  nome            VARCHAR NOT NULL
  saldo_inicial   DECIMAL(12,2) DEFAULT 0.00  -- saldo real ao criar a conta
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
}
```

**`saldo_inicial`**: representa o saldo que o usuário já possui na vida real ao criar a conta no sistema. Sem isso, toda projeção partiria de zero — uma premissa falsa. O motor de projeção utiliza `saldo_inicial` como base para o primeiro mês de cálculo. Atualizável via `PATCH /contas/{contaId}`.

#### Associação Usuário ↔ Conta

```
ContaUsuario {
  id          UUID (PK)
  conta_id    UUID (FK → Conta)
  usuario_id  UUID (FK → Usuario)
  papel       ENUM('owner', 'viewer')
  created_at  TIMESTAMP
}
```

#### Movimentação

```
Movimentacao {
  id            UUID (PK)
  conta_id      UUID (FK -> Conta)
  usuario_id    UUID (FK -> Usuario)      -- quem registrou
  categoria_id  UUID (FK -> Categoria)    -- A Categoria já define se é Receita ou Despesa
  descricao     VARCHAR
  valor         DECIMAL(12,2) NOT NULL    -- sempre positivo
  data          DATE NOT NULL
  recorrente    BOOLEAN DEFAULT false
  data_fim      DATE NULL                 -- NULL = recorrência indefinida; preenchido = última ocorrência
  created_at    TIMESTAMP
  updated_at    TIMESTAMP
}
```

#### Dívida (registro-mãe)

```
Divida {
  id              UUID (PK)
  conta_id        UUID (FK → Conta)
  usuario_id      UUID (FK → Usuario)     -- quem registrou
  categoria_id    UUID (FK → Categoria)
  descricao       VARCHAR NOT NULL
  valor_total     DECIMAL(12,2) NOT NULL
  total_parcelas  INTEGER NOT NULL (>= 1)
  valor_parcela   DECIMAL(12,2) NOT NULL
  data_inicio     DATE NOT NULL           -- vencimento da 1ª parcela
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
}
```

**Regra de arredondamento:** quando `valor_total / total_parcelas` não resulta em divisão exata, as N-1 primeiras parcelas recebem o valor truncado em 2 casas, e a **última parcela absorve a diferença**. Exemplo: R$1.000 em 3x → R$333.33 + R$333.33 + R$333.34.

#### Parcela de Dívida

```
ParcelaDivida {
  id               UUID (PK)
  divida_id        UUID (FK → Divida)
  numero_parcela   INTEGER NOT NULL       -- 1, 2, 3... N
  valor            DECIMAL(12,2) NOT NULL
  data_vencimento  DATE NOT NULL
  data_pagamento   DATE NULL              -- NULL = pendente; preenchido = pago
  created_at       TIMESTAMP
  updated_at       TIMESTAMP
}
```

#### Meta de Reserva de Emergência

```
Meta {
  id                    UUID (PK)
  conta_id              UUID (FK → Conta) UNIQUE
  porcentagem_reserva   DECIMAL(5,2) NOT NULL  -- 0.00 a 100.00
  created_at            TIMESTAMP
  updated_at            TIMESTAMP
}
```

#### Projeção Persistida

```
Projecao {
  id              UUID (PK)
  conta_id        UUID (FK → Conta)
  mes             VARCHAR NOT NULL         -- formato 'YYYY-MM'
  dados           JSONB NOT NULL           -- array de dias + resumo
  status          ENUM('atualizada', 'invalidada') DEFAULT 'atualizada'
  recalculado_em  TIMESTAMP NOT NULL
  created_at      TIMESTAMP
  updated_at      TIMESTAMP

  UNIQUE(conta_id, mes)
}
```

**`status`**: indica se a projeção persistida reflete o estado mais recente dos dados. Quando um evento `projecao:invalidada` é emitido, o status muda para `invalidada` imediatamente. O consumidor (frontend) pode verificar esse campo para saber se está lendo dados potencialmente stale. O recálculo assíncrono restaura o status para `atualizada` ao concluir.

**`recalculado_em`**: timestamp do último recálculo concluído. Permite ao frontend exibir "atualizado há X segundos" e decidir se precisa re-fetchar.

### Relacionamentos

```
Usuario      ◄──  N:N  ──►  Conta            (via ContaUsuario, com papel)
Conta        ◄──  1:N  ──►  Movimentacao
Conta        ◄──  1:N  ──►  Divida
Divida       ◄──  1:N  ──►  ParcelaDivida
Conta        ◄──  1:1  ──►  Meta
Conta        ◄──  1:N  ──►  Projecao
Categoria    ◄──  1:N  ──►  Movimentacao
Categoria    ◄──  1:N  ──►  Divida
Usuario      ◄──  1:N  ──►  Movimentacao     (autoria)
Usuario      ◄──  1:N  ──►  Divida           (autoria)
```

### Ciclo de Vida da Dívida

```
┌─────────────────────────────────────────────────────────────┐
│                    REGISTRO DA DÍVIDA                        │
│  Usuário registra: "Sofá R$3.000 em 10x"                    │
│  Sistema cria: 1 Divida + 10 ParcelaDivida                  │
│  Última parcela absorve diferença de arredondamento          │
│  Saldo real da conta: NÃO afetado.                          │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  PROJEÇÃO (enquanto pendente)                │
│  Parcelas só impactam A PARTIR da data de vencimento.       │
│  Antes do vencimento: parcela é invisível na projeção.      │
│  Após vencimento (não paga): entra em total_dividas_        │
│  pendentes e reduz saldo_liquido. Efeito acumulativo.       │
│  Saldo real da conta: NÃO afetado.                          │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                CONFIRMAÇÃO DE PAGAMENTO                      │
│  Usuário confirma: PATCH /dividas/{dividaId}/parcelas/      │
│                          {parcelaId}/pagamento               │
│  Sistema:                                                    │
│    1. Preenche data_pagamento na parcela                     │
│    2. Debita valor da parcela do saldo real (gera despesa)   │
│    3. Remove parcela de total_dividas_pendentes              │
│    4. Emite evento → recálculo da projeção                   │
└─────────────────────────────────────────────────────────────┘
```

### Ciclo de Vida da Dívida — Deleção

```
┌─────────────────────────────────────────────────────────────┐
│                    DELEÇÃO DA DÍVIDA                         │
│  Permitida SOMENTE se nenhuma parcela foi paga.             │
│  (Todas as parcelas possuem data_pagamento = NULL)           │
│                                                              │
│  Se alguma parcela já foi paga:                              │
│    → 422 Unprocessable Entity                                │
│    → A movimentação (despesa) gerada pelo pagamento já       │
│      alterou o saldo real. Deletar a dívida criaria          │
│      inconsistência.                                         │
│                                                              │
│  Se nenhuma parcela foi paga:                                │
│    → Deleta todas as ParcelaDivida associadas                │
│    → Deleta o registro Divida                                │
│    → Emite evento projecao:invalidada                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Contrato de Rotas da API

### 5.1 Usuários

O registro de usuários é **automático via OIDC**. Não há rota `POST /usuarios` manual.

**Fluxo:**
1. Usuário se autentica no provedor OIDC.
2. Na primeira request autenticada, a API verifica se o `sub` do token já existe no banco.
3. Se não existe, cria o registro `Usuario` com `nome` e `email` extraídos das claims do token.
4. Se já existe, prossegue normalmente.

---

### 5.2 Categorias (Admin)

#### `POST /categorias`

Cria uma nova categoria. **Restrito a `admin`.**

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "nome": "string (obrigatório)",
  "tipo": "receita | despesa | divida (obrigatório)"
}
```

**Regras de validação:**
- A combinação `(nome, tipo)` deve ser única.
- `tipo` determina em quais formulários a categoria aparece.

**Resposta `201`:**
```json
{
  "id": "uuid",
  "nome": "Alimentação",
  "tipo": "despesa",
  "created_at": "2024-01-15T10:00:00Z"
}
```

**Respostas:**
| Status | Descrição |
|--------|-----------|
| `201 Created` | Categoria criada |
| `403 Forbidden` | Solicitante não é `admin` |
| `422 Unprocessable Entity` | Combinação nome+tipo já existe |

---

#### `GET /categorias`

Lista categorias disponíveis. **Acessível a todos os usuários autenticados.**

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `tipo` | string | null | Filtro: `receita`, `despesa`, `divida` |
| `busca` | string | null | Busca parcial pelo nome (ex: alim) |
| `page` | integer | 1 | Número da página atual |
| `limit` | integer | 10 | Quantidade de registros por página |


**Resposta `200`:**
```json
{
  "data": [
    { "id": "uuid", "nome": "Alimentação", "tipo": "despesa" },
    { "id": "uuid", "nome": "Saúde e Bem-estar", "tipo": "despesa" }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

---

#### `PUT /categorias/{categoriaId}`

Atualiza uma categoria existente. **Restrito a `admin`.**

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "nome": "string (obrigatório)",
  "tipo": "receita | despesa | divida (obrigatório)"
}
```

**Respostas:**
| Status | Descrição |
|--------|-----------|
| `200 OK` | Categoria atualizada |
| `403 Forbidden` | Solicitante não é `admin` |
| `404 Not Found` | Categoria não encontrada |
| `422 Unprocessable Entity` | Combinação nome+tipo já existe |

---

#### `DELETE /categorias/{categoriaId}`

Remove uma categoria. **Restrito a `admin`.**

**Headers:** `Authorization: Bearer {token}`

**Regras:**
- Não é possível deletar uma categoria que possui movimentações ou dívidas vinculadas. Retorna `422` com mensagem indicando que há registros dependentes.

**Respostas:**
| Status | Descrição |
|--------|-----------|
| `200 OK` | Categoria removida |
| `403 Forbidden` | Solicitante não é `admin` |
| `404 Not Found` | Categoria não encontrada |
| `422 Unprocessable Entity` | Categoria possui registros vinculados |

---

### 5.3 Contas

#### `POST /contas`

Cria uma nova conta financeira compartilhada. O criador é automaticamente `owner`.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "nome": "string (obrigatório)",
  "saldo_inicial": "number >= 0 (opcional, default: 0.00)"
}
```

**Resposta `201`:**
```json
{
  "id": "uuid",
  "nome": "Conta Casa",
  "saldo_inicial": 5000.00,
  "papel": "owner",
  "created_at": "2024-01-15T10:00:00Z"
}
```

---

#### `GET /contas`

Lista as contas vinculadas ao usuário autenticado.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `page` | integer | 1 | Página atual |
| `limit` | integer | 10 | Itens por página |
| `busca` | string | — | Busca por nome da conta |

**Resposta `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "nome": "Conta Casa",
      "saldo_inicial": 5000.00,
      "papel": "owner",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

#### `PATCH /contas/{contaId}`

Atualiza dados da conta. **Restrito a `owner`.**

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "nome": "string (opcional)",
  "saldo_inicial": "number >= 0 (opcional)"
}
```

**Regras:**
- Alterar `saldo_inicial` emite evento `projecao:invalidada` para todos os meses, pois afeta a base de cálculo.

**Respostas:**
| Status | Descrição |
|--------|-----------|
| `200 OK` | Conta atualizada |
| `403 Forbidden` | Solicitante não é `owner` |
| `404 Not Found` | Conta não encontrada |

---

#### `POST /contas/{contaId}/usuarios`

Associa novos membros a uma conta. **Restrito a `owner`.**

**Headers:** `Authorization: Bearer {token}`

**Path Params:** `contaId` (UUID)

**Request Body:**
```json
{
  "email": "string (obrigatório)",
  "papel": "owner | viewer"
}
```

**Respostas:**
| Status | Descrição |
|--------|-----------|
| `201 Created` | Membro associado |
| `403 Forbidden` | Solicitante não é `owner` |
| `404 Not Found` | Conta ou usuário não encontrado |

---

### 5.4 Movimentações (Receitas e Despesas)

#### `POST /movimentacoes`

Registra uma receita ou despesa. **Restrito a `owner`.**

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "contaId": "uuid (obrigatório)",
  "tipo": "receita | despesa (obrigatório)",
  "categoriaId": "uuid (obrigatório, deve corresponder ao tipo)",
  "descricao": "string (opcional)",
  "valor": "number > 0 (obrigatório)",
  "data": "YYYY-MM-DD (obrigatório)",
  "recorrente": "boolean (default: false)",
  "data_fim": "YYYY-MM-DD (opcional, só aceito se recorrente=true)"
}
```

**Regras de validação:**
- `valor` deve ser estritamente positivo.
- `tipo` aceita `receita` ou `despesa` (dívidas têm rota própria).
- `categoriaId` deve existir e seu `tipo` deve corresponder ao `tipo` da movimentação.
- `data` deve ser uma data válida no formato ISO.
- `data_fim` só é aceito quando `recorrente = true`. Se `recorrente = false` e `data_fim` for enviado, retorna `422`.

**Efeito colateral:** Emite evento `projecao:invalidada` → recálculo da projeção.

**Respostas:**
| Status | Descrição |
|--------|-----------|
| `201 Created` | Movimentação registrada |
| `403 Forbidden` | Solicitante não é `owner` |
| `422 Unprocessable Entity` | Valor negativo, tipo inválido, categoria incompatível, data_fim sem recorrente, etc. |

---

#### `PUT /movimentacoes/{movimentacaoId}`

Atualiza uma movimentação existente. **Restrito a `owner`.**

**Headers:** `Authorization: Bearer {token}`

**Request Body:** mesmos campos do `POST`, todos opcionais (partial update).

**Caso especial — Cancelamento de recorrência:**
```json
{
  "recorrente": false
}
```
Ao definir `recorrente: false`, a replicação é interrompida a partir do mês seguinte. Meses anteriores já projetados **não são afetados** — o histórico é preservado. O campo `data_fim` é automaticamente limpo (null).

**Caso especial — Definir data limite de recorrência:**
```json
{
  "data_fim": "2025-06-30"
}
```
A movimentação será replicada na projeção até o mês de `data_fim` (inclusive). Meses posteriores não a incluirão.

**Efeito colateral:** Emite evento `projecao:invalidada` → recálculo.

**Respostas:**
| Status | Descrição |
|--------|-----------|
| `200 OK` | Movimentação atualizada |
| `403 Forbidden` | Solicitante não é `owner` |
| `404 Not Found` | Movimentação não encontrada |
| `422 Unprocessable Entity` | Validação falhou |

---

#### `DELETE /movimentacoes/{movimentacaoId}`

Remove uma movimentação. **Restrito a `owner`.**

**Headers:** `Authorization: Bearer {token}`

**Regras:**
- Movimentações geradas automaticamente pelo sistema (pagamento de parcela de dívida) **não podem ser deletadas** diretamente. O vínculo com a parcela impede a deleção — retorna `422` com código `SYSTEM_GENERATED_RESOURCE`.
- Movimentações manuais podem ser deletadas livremente.

**Efeito colateral:** Emite evento `projecao:invalidada` → recálculo.

**Respostas:**
| Status | Descrição |
|--------|-----------|
| `200 OK` | Movimentação removida |
| `403 Forbidden` | Solicitante não é `owner` |
| `404 Not Found` | Movimentação não encontrada |
| `422 Unprocessable Entity` | Movimentação gerada pelo sistema (pagamento de parcela) |

---

#### `GET /movimentacoes`

Histórico paginado de transações de uma conta.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `contaId` | UUID | — | Obrigatório |
| `page` | integer | 1 | Página atual |
| `limit` | integer | 10 | Itens por página |
| `busca` | string | — | Busca por descrição |
| `data_inicio` | date | — | Filtro de data (início) |
| `data_fim` | date | — | Filtro de data (fim) |
| `tipo` | string | — | Filtro: `receita`, `despesa` |
| `categoriaId` | UUID | — | Filtro por categoria |

**Resposta `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "tipo": "despesa",
      "categoria": {
        "id": "uuid",
        "nome": "Alimentação"
      },
      "descricao": "Supermercado",
      "valor": 450.00,
      "data": "2024-01-20",
      "recorrente": false,
      "data_fim": null,
      "usuario": {
        "id": "uuid",
        "nome": "João"
      },
      "created_at": "2024-01-20T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

---

### 5.5 Dívidas

#### `POST /dividas`

Registra uma nova dívida com parcelamento automático. **Restrito a `owner`.**

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "contaId": "uuid (obrigatório)",
  "descricao": "string (obrigatório)",
  "categoriaId": "uuid (obrigatório, tipo deve ser 'divida')",
  "valor_total": "number > 0 (obrigatório)",
  "total_parcelas": "integer >= 1 (obrigatório)",
  "data_inicio": "YYYY-MM-DD (obrigatório, vencimento da 1ª parcela)"
}
```

**Comportamento do sistema:**
1. Cria o registro `Divida` com os dados informados.
2. Calcula `valor_parcela = valor_total / total_parcelas` (truncado em 2 casas decimais).
3. Última parcela absorve a diferença de arredondamento.
4. Gera automaticamente N registros `ParcelaDivida` com datas de vencimento mensais sequenciais a partir de `data_inicio`.
5. Emite evento `projecao:invalidada` → recálculo para os meses afetados.

**Exemplo:** Registro de "Sofá R$3.000 em 10x" com `data_inicio: 2024-02-15` gera:
- Parcela 1/10 → vencimento: 2024-02-15, valor: R$300.00
- Parcela 2/10 → vencimento: 2024-03-15, valor: R$300.00
- ...
- Parcela 10/10 → vencimento: 2024-11-15, valor: R$300.00

**Resposta `201`:**
```json
{
  "id": "uuid",
  "descricao": "Sofá",
  "categoria": {
    "id": "uuid",
    "nome": "Cartão de Crédito"
  },
  "valor_total": 3000.00,
  "total_parcelas": 10,
  "valor_parcela": 300.00,
  "data_inicio": "2024-02-15",
  "parcelas": [
    {
      "id": "uuid",
      "numero_parcela": 1,
      "valor": 300.00,
      "data_vencimento": "2024-02-15",
      "data_pagamento": null
    },
    {
      "id": "uuid",
      "numero_parcela": 2,
      "valor": 300.00,
      "data_vencimento": "2024-03-15",
      "data_pagamento": null
    }
  ]
}
```

**Respostas:**
| Status | Descrição |
|--------|-----------|
| `201 Created` | Dívida registrada com parcelas geradas |
| `403 Forbidden` | Solicitante não é `owner` |
| `422 Unprocessable Entity` | Valor negativo, parcelas < 1, categoria incompatível, etc. |

---

#### `GET /dividas`

Lista as dívidas de uma conta com status das parcelas.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `contaId` | UUID | — | Obrigatório |
| `page` | integer | 1 | Página atual |
| `limit` | integer | 10 | Itens por página |
| `status` | string | — | Filtro: `pendente`, `quitada` |

Uma dívida é `quitada` quando todas as suas parcelas possuem `data_pagamento` preenchido.

---

#### `DELETE /dividas/{dividaId}`

Remove uma dívida e todas as suas parcelas. **Restrito a `owner`.**

**Headers:** `Authorization: Bearer {token}`

**Regras:**
- Somente dívidas onde **nenhuma parcela foi paga** (`data_pagamento = NULL` em todas) podem ser deletadas.
- Se alguma parcela já possui `data_pagamento` preenchido, retorna `422` — porque o pagamento já gerou uma movimentação de despesa que alterou o saldo real. Deletar a dívida nesse caso criaria inconsistência.

**Efeito colateral:** Emite evento `projecao:invalidada` → recálculo.

**Respostas:**
| Status | Descrição |
|--------|-----------|
| `200 OK` | Dívida e parcelas removidas |
| `403 Forbidden` | Solicitante não é `owner` |
| `404 Not Found` | Dívida não encontrada |
| `422 Unprocessable Entity` | Dívida possui parcelas já pagas |

---

#### `PATCH /dividas/{dividaId}/parcelas/{parcelaId}/pagamento`

Confirma o pagamento de uma parcela. **Restrito a `owner`.**

**Headers:** `Authorization: Bearer {token}`

**Path Params:** `dividaId` (UUID), `parcelaId` (UUID)

**Request Body:**
```json
{
  "data_pagamento": "YYYY-MM-DD (obrigatório)"
}
```

**Comportamento do sistema:**
1. Preenche `data_pagamento` na parcela.
2. Gera automaticamente uma `Movimentacao` do tipo `despesa` com o valor da parcela na `data_pagamento`, debitando do saldo real da conta.
3. Remove a parcela de `total_dividas_pendentes` na projeção.
4. Emite evento `projecao:invalidada` → recálculo.

**Regras:**
- `data_pagamento` pode ser anterior à `data_vencimento` (pagamento antecipado permitido).
- Parcela já paga (`data_pagamento != null`) retorna `422`.

**Resposta `200`:**
```json
{
  "id": "uuid-parcela",
  "numero_parcela": 1,
  "valor": 300.00,
  "data_vencimento": "2024-02-15",
  "data_pagamento": "2024-02-10",
  "movimentacao_gerada": {
    "id": "uuid-movimentacao",
    "tipo": "despesa",
    "valor": 300.00,
    "data": "2024-02-10"
  }
}
```

**Respostas:**
| Status | Descrição |
|--------|-----------|
| `200 OK` | Pagamento confirmado, despesa gerada |
| `403 Forbidden` | Solicitante não é `owner` |
| `404 Not Found` | Dívida ou parcela não encontrada |
| `422 Unprocessable Entity` | Parcela já paga |

---

### 5.6 Metas de Reserva de Emergência

#### `POST /metas`

Define o percentual de reserva de emergência para construção de patrimônio. **Restrito a `owner`.** A meta é uma decisão coletiva da conta — todos os membros compartilham o mesmo objetivo de reserva.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "contaId": "uuid (obrigatório)",
  "porcentagem_reserva": 20
}
```

**Regras de validação:**
- `porcentagem_reserva` deve estar entre `0` e `100` (inclusive).
- Valores fora desse range retornam `422`.
- Não há trava de viabilidade: o sistema permite qualquer percentual dentro do range, mesmo que incompatível com o padrão de gastos atual. O Indicador de Reserva reflete a realidade.

**Efeito colateral:** Emite evento `projecao:invalidada` → recálculo do indicador de reserva.

**Respostas:**
| Status | Descrição |
|--------|-----------|
| `201 Created` | Meta definida/atualizada |
| `403 Forbidden` | Solicitante não é `owner` |
| `422 Unprocessable Entity` | `porcentagem_reserva > 100` ou negativa |

---

### 5.7 Limite Diário de Gasto

#### `GET /contas/{contaId}/limite-diario`

Retorna o limite diário de gasto calculado dinamicamente. **O limite diário é independente da meta de reserva de emergência** — ele opera sobre o saldo real da conta.

**Headers:** `Authorization: Bearer {token}`

**Path Params:** `contaId` (UUID)

**Fórmula:**
```
saldo_disponivel = saldo_conta - despesas_fixas_pendentes_mes
limite_diario    = saldo_disponivel / dias_restantes_no_mes
```

Onde `despesas_fixas_pendentes_mes` inclui:
- Movimentações com `recorrente = true` do tipo `despesa` que ainda não ocorreram no mês corrente.
- Parcelas de dívidas com `data_vencimento` dentro do mês corrente e `data_pagamento = NULL`.

O limite diário responde: **"quanto posso gastar por dia sem ficar negativo no fim do mês?"**

A meta de reserva de emergência **não** entra neste cálculo. A reserva é avaliada separadamente pelo Indicador de Reserva.

**Resposta `200`:**
```json
{
  "contaId": "uuid",
  "mes_referencia": "2024-01",
  "saldo_disponivel": 3200.00,
  "despesas_fixas_pendentes": 1800.00,
  "dias_restantes": 16,
  "limite_diario": 200.00,
  "calculado_em": "2024-01-15T10:00:00Z"
}
```

---

### 5.8 Projeção Financeira

#### `GET /projecao`

Gera um array diário de saúde financeira para um mês específico.

**Headers:** `Authorization: Bearer {token}`
**Segurança (Autorização):**
O backend deve validar se o usuário autenticado no Token é o dono (ou tem permissão de leitura) da conta informada em `contaId`

**Query Params:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| `contaId` | UUID | Obrigatório |
| `mes` | string | Formato `YYYY-MM` (obrigatório) |

**Comportamento de cache e cálculo:**
1. O sistema verifica se existe uma projeção persistida para `(contaId, mes)` com `status = 'atualizada'`.
2. Se sim, retorna os dados do cache.
3. Se não existe ou `status = 'invalidada'`, recalcula.
4. Se o mês anterior não possui projeção persistida, calcula-o primeiro (cascata lazy). Ex: pedir março sem fevereiro calculado → calcula fevereiro, persiste, depois calcula março.
5. O resultado é persistido na tabela `Projecao` com `status = 'atualizada'`.

**Resposta `200` (com meta definida):**
```json
{
  "contaId": "uuid",
  "mes": "2024-01",
  "status": "atualizada",
  "recalculado_em": "2024-01-20T14:30:00Z",
  "meta_reserva": {
    "porcentagem": 20,
    "valor_ideal": 1000.00
  },
  "projecao": [
    {
      "data": "2024-01-01",
      "receitas_dia": 5000.00,
      "despesas_dia": 1200.00,
      "parcelas_pagas_dia": 0.00,
      "saldo_projetado": 3800.00,
      "total_dividas_pendentes": 0.00,
      "saldo_liquido": 3800.00,
      "indicador_reserva": "verde"
    },
    {
      "data": "2024-01-15",
      "receitas_dia": 0.00,
      "despesas_dia": 50.00,
      "parcelas_pagas_dia": 0.00,
      "saldo_projetado": 2750.00,
      "total_dividas_pendentes": 300.00,
      "saldo_liquido": 2450.00,
      "indicador_reserva": "verde"
    }
  ],
  "resumo": {
    "total_receitas": 5000.00,
    "total_despesas": 2800.00,
    "total_parcelas_pagas": 300.00,
    "total_dividas_pendentes": 200.00,
    "saldo_final_projetado": 1900.00,
    "saldo_liquido_final": 1700.00,
    "reserva_ideal": 1000.00,
    "reserva_atingida": true,
    "indicador_reserva_final": "verde"
  }
}
```

**Resposta `200` (sem meta definida):**
```json
{
  "contaId": "uuid",
  "mes": "2024-01",
  "status": "atualizada",
  "recalculado_em": "2024-01-20T14:30:00Z",
  "meta_reserva": null,
  "projecao": [
    {
      "data": "2024-01-01",
      "receitas_dia": 5000.00,
      "despesas_dia": 1200.00,
      "parcelas_pagas_dia": 0.00,
      "saldo_projetado": 3800.00,
      "total_dividas_pendentes": 0.00,
      "saldo_liquido": 3800.00,
      "indicador_reserva": null
    }
  ],
  "resumo": {
    "total_receitas": 5000.00,
    "total_despesas": 2800.00,
    "total_parcelas_pagas": 0.00,
    "total_dividas_pendentes": 0.00,
    "saldo_final_projetado": 2200.00,
    "saldo_liquido_final": 2200.00,
    "reserva_ideal": null,
    "reserva_atingida": null,
    "indicador_reserva_final": null
  }
}
```

Quando `meta_reserva` é `null`, o indicador de reserva é desabilitado em toda a projeção. O frontend pode usar essa informação para exibir um convite ao usuário para definir sua meta.

---

## 6. Regras de Negócio

### 6.1 Tipos de Movimentação

| Tipo | Impacto no Saldo Real | Impacto na Projeção |
|------|----------------------|---------------------|
| `receita` | **Soma** ao saldo | Aumenta saldo projetado |
| `despesa` | **Subtrai** do saldo | Reduz saldo projetado |

Dívidas **não** são movimentações — possuem entidade e rotas próprias.

### 6.2 Modelo de Dívida

A dívida possui dois momentos distintos:

**Momento 1 — Registro:**
- Usuário informa valor total, número de parcelas e data da primeira parcela.
- Sistema gera automaticamente as N parcelas com vencimentos mensais.
- Parcelas pendentes (`data_pagamento = null`) aparecem como **passivo** na projeção **somente a partir da data de vencimento**.
- O saldo real da conta **não** é afetado.
- Última parcela absorve diferença de arredondamento quando a divisão não é exata.

**Momento 2 — Confirmação de Pagamento:**
- Usuário confirma pagamento de uma parcela específica, informando `data_pagamento`.
- Sistema gera uma `despesa` automática com o valor da parcela, **debitando do saldo real**.
- A parcela sai de `total_dividas_pendentes` na projeção.
- Pagamento antecipado é permitido (`data_pagamento < data_vencimento`).
- Parcelas vencidas e não pagas permanecem como passivo normal e **acumulam** — o frontend decide como apresentar (alertas, destaque visual, notificações).

**Momento 3 — Deleção (apenas se nenhuma parcela paga):**
- Se nenhuma parcela foi paga, a dívida pode ser completamente removida.
- Se pelo menos uma parcela foi paga, a deleção é bloqueada para evitar inconsistência com as movimentações de despesa já geradas.

**Transição de estados de uma parcela:**
```
[PENDENTE] ──── confirma pagamento ────► [PAGA]
  │                                        │
  │ data_pagamento = null                  │ data_pagamento = YYYY-MM-DD
  │ Impacto: passivo a partir do           │ Impacto: despesa no saldo real
  │          vencimento                    │ Saldo real: debitado
  │ Saldo real: inalterado                 │
```

### 6.3 Categorias

- Gerenciadas exclusivamente pelo **admin** do sistema.
- As categorias são **genéricas e abrangentes** (ex: "Transferências Familiares", "Lazer e Entretenimento"), servindo como taxonomia universal. Casos específicos como "mesada do filho" são classificados dentro de categorias maiores — a especificidade fica na `descricao` da movimentação.
- Cada categoria possui um `tipo` associado (`receita`, `despesa`, `divida`).
- Movimentações e dívidas referenciam categorias por `categoriaId`.
- A API valida que o `tipo` da categoria corresponde ao `tipo` da movimentação/dívida.
- Categorias com registros vinculados não podem ser deletadas.

### 6.4 Meta de Reserva de Emergência

- Percentual livre (`0–100%`), definido pelo `owner`.
- A meta é uma **decisão coletiva da conta**: em contas compartilhadas (ex: casal), os membros devem alinhar o percentual desejado. O sistema não suporta metas individuais por membro — a unidade de decisão é a conta.
- **Recomendação soft:** 20–30% (orientação exibida no frontend, não imposta pela API).
- Incide sobre **receitas brutas** (total de entradas do mês).
- **Não há trava de viabilidade:** se o percentual for incompatível com o padrão de gastos, o indicador de reserva reflete isso (amarelo ou vermelho). O valor do sistema é mostrar a realidade, não escondê-la.
- Uma conta possui no máximo **uma meta ativa** (relação 1:1).
- `422` apenas para valores fora de `0–100` ou negativos.
- **Sem meta definida, o Indicador de Reserva é desabilitado** (`null`). O sistema não assume fallback.

**Cálculo da reserva ideal:**
```
reserva_ideal = receitas_brutas_mes × (porcentagem_reserva / 100)
```

### 6.5 Separação: Limite Diário vs. Indicador de Reserva

O Limite Diário e o Indicador de Reserva são **indicadores independentes** que respondem perguntas diferentes:

| Indicador | Pergunta que responde | Base de cálculo | Requer meta? |
|-----------|----------------------|-----------------|-------------|
| **Limite Diário** | "Quanto posso gastar hoje sem ficar negativo?" | Saldo real da conta − despesas fixas pendentes (recorrentes + parcelas do mês) | Não |
| **Indicador de Reserva** | "Estou no caminho de construir patrimônio este mês?" | Receitas brutas × meta vs. sobra real projetada | **Sim** |

É possível (e esperado) que o limite diário seja positivo enquanto o indicador de reserva está amarelo. Isso significa: "você não vai quebrar, mas não está atingindo a reserva de emergência que planejou." Essa tensão entre os dois indicadores é **intencional e educativa**.

### 6.6 Movimentações Recorrentes

- Quando `recorrente = true`, a movimentação é replicada automaticamente nos meses subsequentes na projeção.
- **Recorrência é indefinida por padrão.** Não há expiração automática. A movimentação continua sendo projetada até que o usuário a cancele ou defina uma data limite.
- **Data limite (`data_fim`):** o usuário pode opcionalmente definir uma data final. A movimentação é replicada na projeção até o mês de `data_fim` (inclusive). Meses posteriores não a incluem.
- **Cancelamento:** via `PUT /movimentacoes/{id}` com `recorrente: false`. A replicação é interrompida a partir do mês seguinte. Projeções de meses anteriores **não são afetadas** — o histórico é preservado. O campo `data_fim` é automaticamente limpo.
- **Caso de uso:** salário (`recorrente: true`, `data_fim: null`) continua indefinidamente. Aluguel com contrato de 12 meses (`recorrente: true`, `data_fim: "2025-12-31"`) para na data definida.

### 6.7 Saldo Inicial e Saldo Transportado

- Cada conta possui um `saldo_inicial` que representa o valor real que o usuário já possui ao criar a conta no sistema.
- O `saldo_projetado[0]` do **primeiro mês** da conta utiliza `saldo_inicial` como base.
- Para meses subsequentes, o `saldo_projetado[0]` é o **saldo final calculado do mês anterior**.
- O transporte é automático e calculado pelo motor de projeção via cascata lazy (ver seção 7).

---

## 7. Motor de Projeção e Indicador de Reserva

### Estratégia de Cálculo: Cascata Lazy com Cache

A projeção é calculada **sob demanda** e **persistida** no PostgreSQL para evitar recálculo desnecessário.

**Fluxo ao solicitar projeção de um mês:**
```
GET /projecao?contaId=X&mes=2024-03
  │
  ├─ Existe Projecao(X, '2024-03') com status='atualizada'?
  │   └─ SIM → retorna dados do cache
  │
  ├─ Existe Projecao(X, '2024-03') com status='invalidada'?
  │   └─ SIM → precisa recalcular
  │       └─ Para recalcular, precisa do saldo final de 2024-02
  │           ├─ Existe Projecao(X, '2024-02') com status='atualizada'?
  │           │   └─ SIM → usa saldo_final como base, recalcula março
  │           │   └─ NÃO → recalcula fevereiro primeiro (recursão)
  │           └─ Caso base: primeiro mês → usa saldo_inicial da conta
  │
  └─ Não existe Projecao(X, '2024-03')?
      └─ Mesmo fluxo de recálculo acima
```

**Invalidação em cascata:** quando um evento invalida um mês (ex: fevereiro), todos os meses posteriores que já possuem projeção persistida também recebem `status = 'invalidada'`, porque o saldo transportado mudou. Isso é feito via um único UPDATE:
```sql
UPDATE projecao
SET status = 'invalidada'
WHERE conta_id = $1
  AND mes >= $2;
```

**Proteção contra cascata profunda:** o sistema limita a profundidade de cálculo recursivo a 12 meses. Se a cascata precisar recalcular mais de 12 meses, retorna `422` com mensagem sugerindo que o usuário atualize o `saldo_inicial`.

### Lógica de Cálculo (dia a dia)

Para cada dia `d` do mês solicitado:

```
1. saldo_projetado[d] = saldo_projetado[d-1]
                        + receitas[d]
                        - despesas[d]
                        - parcelas_pagas[d]

2. total_dividas_pendentes[d] = soma de todas as parcelas com
                                 data_vencimento <= d AND data_pagamento IS NULL

3. saldo_liquido[d] = saldo_projetado[d] - total_dividas_pendentes[d]
```

Onde:
- `saldo_projetado[0]` = saldo final do mês anterior (via cascata) ou `saldo_inicial` (para conta nova).
- `parcelas_pagas[d]` = parcelas com `data_pagamento = d` (já convertidas em despesa no saldo real).
- `total_dividas_pendentes[d]` = passivo acumulado de parcelas não pagas **cujo vencimento já chegou** (`data_vencimento <= d`).
- Receitas e despesas incluem movimentações recorrentes projetadas (indefinidamente ou até `data_fim`).

**Regra crítica — dívidas só impactam a partir do vencimento:**

Uma parcela com `data_vencimento` futuro é **invisível** na projeção até que o dia do vencimento chegue. Antes disso, ela não entra em `total_dividas_pendentes` e não afeta o `saldo_liquido` nem o indicador de reserva.

Exemplo prático:
```
Dívida: Sofá R$3.000 em 10x — 1ª parcela vence 15/02

Projeção de Janeiro:
  total_dividas_pendentes = 0 (nenhuma parcela venceu ainda)
  Indicador de Reserva ignora esta dívida completamente.

Projeção de Fevereiro:
  Dia 01 a 14/02 → total_dividas_pendentes não inclui parcela 1
  Dia 15/02 em diante → parcela 1 (R$300) entra como passivo

Projeção de Março (parcela 1 NÃO paga):
  Dia 01 a 14/03 → total_dividas_pendentes = R$300 (parcela 1 vencida)
  Dia 15/03 em diante → total_dividas_pendentes = R$600 (parcela 1 + parcela 2)
```

Parcelas vencidas e não pagas **acumulam** — o efeito bola de neve é intencional e reflete a realidade do endividamento.

### Indicador de Reserva

O indicador de reserva responde: **"estou no caminho de construir patrimônio este mês?"**

**Pré-requisito:** o indicador só opera quando a conta possui uma **meta de reserva de emergência definida**. Sem meta, o indicador retorna `null` em toda a projeção.

**Fórmulas (quando meta está definida):**
```
reserva_ideal = receitas_brutas_mes × (porcentagem_reserva / 100)
sobra_real    = saldo_projetado_fim_mes - total_dividas_pendentes_fim_mes
```

**Tabela de Cores:**

| Cor | Condição | Significado |
|-----|----------|-------------|
| 🟢 **Verde** | `sobra_real ≥ reserva_ideal` | No caminho: a sobra projetada atinge ou supera a reserva de emergência |
| 🟡 **Amarelo** | `0 < sobra_real < reserva_ideal` | Saldo positivo, mas a reserva de emergência não será atingida |
| 🔴 **Vermelho** | `sobra_real ≤ 0` | Saldo insuficiente: gastando mais do que entra |

**Sem meta definida:**
- `meta_reserva` retorna `null`.
- `indicador_reserva` retorna `null` em cada dia e no resumo.
- O frontend pode utilizar esse estado para convidar o usuário a definir sua meta.

---

## 8. Sistema de Eventos e Recálculo

### Arquitetura de Eventos

O recálculo da projeção é acionado por eventos internos via **EventEmitter nativo do Node.js**, aproveitando a arquitetura de hooks do Fastify.

**Padrão:**
```
Fastify Route Handler
  → Service executa mutação (INSERT/UPDATE/DELETE no PostgreSQL)
  → Responde ao cliente (201/200)
  → Marca projeções afetadas como 'invalidada' (UPDATE síncrono)
  → eventEmitter.emit('projecao:recalcular', { contaId, mesInicial })
      ↓
  Listener: motorProjecao.recalcular(contaId, mesInicial)
      ↓
  Resultado persistido no PostgreSQL com status='atualizada'
```

**Fluxo de invalidação em duas fases:**
1. **Fase síncrona (antes da resposta):** marca `status = 'invalidada'` em todas as projeções afetadas. Isso é rápido (um UPDATE) e garante que qualquer leitura concorrente saiba que os dados estão stale.
2. **Fase assíncrona (após resposta):** o EventEmitter dispara o recálculo efetivo. Pode levar mais tempo, mas não bloqueia a request.

### Eventos Emitidos

| Evento | Disparado por | Payload |
|--------|--------------|---------|
| `projecao:recalcular` | `POST /movimentacoes` | `{ contaId, mesInicial: '2024-01' }` |
| `projecao:recalcular` | `PUT /movimentacoes/{id}` | `{ contaId, mesInicial: '2024-01' }` |
| `projecao:recalcular` | `DELETE /movimentacoes/{id}` | `{ contaId, mesInicial: '2024-01' }` |
| `projecao:recalcular` | `POST /dividas` | `{ contaId, mesInicial: '2024-02' }` |
| `projecao:recalcular` | `DELETE /dividas/{id}` | `{ contaId, mesInicial: '2024-02' }` |
| `projecao:recalcular` | `PATCH .../pagamento` | `{ contaId, mesInicial: '2024-02' }` |
| `projecao:recalcular` | `POST /metas` | `{ contaId, mesInicial: '2024-01' }` |
| `projecao:recalcular` | `PATCH /contas/{id}` (saldo_inicial) | `{ contaId, mesInicial: 'primeiro_mes' }` |

### Consistência em Cluster Mode (PM2)

O EventEmitter é per-process. Em cluster mode, apenas o processo que recebeu a request executa o recálculo. Isso é aceitável porque:

1. **A invalidação é síncrona e no PostgreSQL:** antes de responder, o processo marca as projeções como `invalidada` no banco. Todos os processos leem do mesmo banco.
2. **Leituras concorrentes recebem `status: 'invalidada'`:** o frontend sabe que os dados são stale e pode exibir um indicador de "atualizando..." ou re-fetchar em poucos segundos.
3. **O campo `recalculado_em`** permite ao frontend implementar polling inteligente: se `status = 'invalidada'`, re-fetch após 1-2 segundos.
4. **Não há risco de cálculo duplicado:** mesmo que dois processos invalidem, o recálculo é idempotente — recalcular a mesma projeção duas vezes produz o mesmo resultado.

### Decisões de Design

- **In-process (sem fila externa):** para o MVP, o EventEmitter nativo é suficiente. Não há dependência de Redis/BullMQ.
- **Persistência no PostgreSQL:** o resultado do recálculo é gravado no banco com `status` e `recalculado_em`.
- **Invalidação síncrona, recálculo assíncrono:** a marcação de `invalidada` é feita antes de responder ao cliente. O recálculo pesado acontece depois.
- **Escalabilidade futura:** se o volume exigir, a migração para BullMQ é direta — o evento já carrega o payload necessário. Basta trocar `eventEmitter.emit()` por `queue.add()`.

---

## 9. Infraestrutura e DevOps

### Containerização

```yaml
# docker-compose.yml (estrutura conceitual)
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/financial
      - NODE_ENV=production
      - OIDC_ISSUER=https://accounts.google.com
      - OIDC_CLIENT_ID=your-client-id
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=financial
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass

volumes:
  pgdata:
```

### PM2 — Cluster Mode

```javascript
// ecosystem.config.js
module.exports = {
    apps: [{
        name: "financial-api",
        script: "dist/server.js",
        instances: "max",
        exec_mode: "cluster",
        max_memory_restart: "512M",
        env_production: {
            NODE_ENV: "production"
        }
    }]
};
```

### Logging com Pino

Todos os logs são estruturados em JSON com `requestId` injetado automaticamente:

```json
{
  "level": 30,
  "time": 1705312200000,
  "requestId": "req-abc-123",
  "userId": "uuid-do-usuario",
  "msg": "Movimentação criada",
  "contaId": "uuid-da-conta",
  "tipo": "despesa",
  "valor": 450.00
}
```

### Diagnóstico com Clinic.js

Ferramentas integradas para análise de performance:
- **Doctor**: detecção de problemas gerais (event loop delays, GC pressure).
- **Flame**: flamegraphs para identificar hot paths de CPU.
- **Bubbleprof**: visualização de operações assíncronas e gargalos de I/O.

### Estratégia de Testes

Abordagem **"No Mocks"** — testes de integração rodam contra PostgreSQL real (containerizado), garantindo fidelidade total das queries e constraints do banco.

```
Testes de Integração
├── PostgreSQL real via Docker
├── Drizzle ORM sem mocks
├── Seed de dados por test suite
└── Rollback transacional entre testes
```

### Documentação da API

Especificação **OpenAPI 3.x** gerada a partir dos schemas do Fastify, disponível em `/docs` (Swagger UI).

---

## 10. Padronização de Respostas e Erros

### Status Codes

| Código | Uso |
|--------|-----|
| `200 OK` | Consultas, listagens, atualizações e confirmações de pagamento |
| `201 Created` | Criação de contas, movimentações, dívidas, categorias e metas |
| `401 Unauthorized` | Token ausente ou expirado |
| `403 Forbidden` | Tentativa de escrita por `viewer` ou acesso admin por não-admin |
| `404 Not Found` | Recurso inexistente |
| `422 Unprocessable Entity` | Violação de regra de negócio |

### Estrutura Padrão de Erro

```json
{
  "timestamp": "2024-01-20T14:30:00Z",
  "requestId": "req-abc-123",
  "message": "O percentual de reserva deve estar entre 0 e 100.",
  "code": "BUSINESS_RULE_VIOLATION"
}
```

### Códigos de Erro de Negócio

| Code | Cenário |
|------|---------|
| `BUSINESS_RULE_VIOLATION` | Reserva > 100%, valor negativo, parcelas < 1, categoria incompatível, data_fim sem recorrente, etc. |
| `INSUFFICIENT_PERMISSIONS` | Operação de escrita por `viewer` ou acesso admin por não-admin |
| `RESOURCE_NOT_FOUND` | Conta, movimentação, dívida, parcela ou categoria inexistente |
| `DUPLICATE_RESOURCE` | Email já cadastrado, meta duplicada, categoria duplicada |
| `ALREADY_PAID` | Tentativa de pagar parcela já quitada |
| `RESOURCE_IN_USE` | Tentativa de deletar categoria com registros vinculados |
| `SYSTEM_GENERATED_RESOURCE` | Tentativa de deletar movimentação gerada automaticamente pelo sistema (pagamento de parcela) |
| `DEBT_HAS_PAYMENTS` | Tentativa de deletar dívida que possui parcelas já pagas |
| `CASCADE_DEPTH_EXCEEDED` | Projeção requer recálculo de mais de 12 meses em cascata |

---

> **Documento gerado como referência técnica para o MVP da Financial Assistant API.**
> Todas as decisões de negócio foram definidas — nenhum TODO pendente.
> Última atualização: Abril 2026 — v2.
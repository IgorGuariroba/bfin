# ── Health ────────────────────────────────────────────────────────────────────

GET http://127.0.0.1:3000/health/live
HTTP 200

GET http://127.0.0.1:3000/health/ready
HTTP 200

GET http://127.0.0.1:3000/health
HTTP 302

# ── Me ────────────────────────────────────────────────────────────────────────

GET http://127.0.0.1:3000/me
Authorization: Bearer {{token}}
HTTP 200

# ── Conta ─────────────────────────────────────────────────────────────────────

POST http://127.0.0.1:3000/contas
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "nome": "Conta Hurl E2E",
  "saldo_inicial": 1000.00
}
HTTP 201
[Captures]
contaId: jsonpath "$.id"

GET http://127.0.0.1:3000/contas?page=1&limit=10
Authorization: Bearer {{token}}
HTTP 200

PATCH http://127.0.0.1:3000/contas/{{contaId}}
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "nome": "Conta Hurl E2E Atualizada"
}
HTTP 200

# ── Categoria (receita) ───────────────────────────────────────────────────────

POST http://127.0.0.1:3000/categorias
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "nome": "Categoria Hurl Receita {{runId}}",
  "tipo": "receita"
}
HTTP 201
[Captures]
categoriaId: jsonpath "$.id"

GET http://127.0.0.1:3000/categorias?tipo=receita&page=1&limit=10
Authorization: Bearer {{token}}
HTTP 200

PUT http://127.0.0.1:3000/categorias/{{categoriaId}}
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "nome": "Categoria Hurl Receita {{runId}} Atualizada",
  "tipo": "receita"
}
HTTP 200

# ── Categoria (divida) ────────────────────────────────────────────────────────

POST http://127.0.0.1:3000/categorias
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "nome": "Categoria Hurl Divida {{runId}}",
  "tipo": "divida"
}
HTTP 201
[Captures]
categoriaIdDivida: jsonpath "$.id"

# ── Movimentação ──────────────────────────────────────────────────────────────

POST http://127.0.0.1:3000/movimentacoes
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "contaId": "{{contaId}}",
  "tipo": "receita",
  "categoriaId": "{{categoriaId}}",
  "descricao": "Receita Hurl E2E",
  "valor": 500.00,
  "data": "2026-04-01",
  "recorrente": false
}
HTTP 201
[Captures]
movimentacaoId: jsonpath "$.id"

GET http://127.0.0.1:3000/movimentacoes?contaId={{contaId}}&page=1&limit=10
Authorization: Bearer {{token}}
HTTP 200

PUT http://127.0.0.1:3000/movimentacoes/{{movimentacaoId}}
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "descricao": "Receita Hurl E2E Atualizada",
  "valor": 750.00
}
HTTP 200

DELETE http://127.0.0.1:3000/movimentacoes/{{movimentacaoId}}
Authorization: Bearer {{token}}
HTTP 200

# ── Limite Diário ─────────────────────────────────────────────────────────────

GET http://127.0.0.1:3000/contas/{{contaId}}/limite-diario
Authorization: Bearer {{token}}
HTTP 200

GET http://127.0.0.1:3000/contas/{{contaId}}/limite-diario-v2
Authorization: Bearer {{token}}
HTTP 200

# ── Projeção ──────────────────────────────────────────────────────────────────

GET http://127.0.0.1:3000/projecao?contaId={{contaId}}&mes=2026-04
Authorization: Bearer {{token}}
HTTP 200

# ── Meta ──────────────────────────────────────────────────────────────────────

POST http://127.0.0.1:3000/metas
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "contaId": "{{contaId}}",
  "porcentagem_reserva": 20
}
HTTP 201

# ── Dívida ────────────────────────────────────────────────────────────────────

POST http://127.0.0.1:3000/dividas
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "contaId": "{{contaId}}",
  "categoriaId": "{{categoriaIdDivida}}",
  "descricao": "Divida Hurl E2E",
  "valorTotal": 600.00,
  "totalParcelas": 3,
  "dataInicio": "2026-05-01"
}
HTTP 201
[Captures]
dividaId: jsonpath "$.id"
parcelaId: jsonpath "$.parcelas[0].id"

GET http://127.0.0.1:3000/dividas?contaId={{contaId}}&page=1&limit=10&status=pendente
Authorization: Bearer {{token}}
HTTP 200

PATCH http://127.0.0.1:3000/dividas/{{dividaId}}/parcelas/{{parcelaId}}/pagamento
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "dataPagamento": "2026-05-10"
}
HTTP 200

# Segunda dívida só pra testar DELETE (primeira já tem parcela paga, business rule bloqueia)

POST http://127.0.0.1:3000/dividas
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "contaId": "{{contaId}}",
  "categoriaId": "{{categoriaIdDivida}}",
  "descricao": "Divida Hurl E2E (delete)",
  "valorTotal": 300.00,
  "totalParcelas": 2,
  "dataInicio": "2026-05-01"
}
HTTP 201
[Captures]
dividaIdDelete: jsonpath "$.id"

DELETE http://127.0.0.1:3000/dividas/{{dividaIdDelete}}
Authorization: Bearer {{token}}
HTTP 200

# ── Cleanup categorias ────────────────────────────────────────────────────────

DELETE http://127.0.0.1:3000/categorias/{{categoriaId}}
Authorization: Bearer {{token}}
HTTP 200

# categoriaIdDivida não pode ser deletada — primeira dívida com parcela paga mantém referência (business rule)

# ── Error cases ────────────────────────────────────────────────────────────────

# Invalid input: missing required fields
POST http://127.0.0.1:3000/contas
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "saldo_inicial": 1000.00
}
HTTP 422

# Not found: non-existent account
GET http://127.0.0.1:3000/contas/00000000-0000-0000-0000-000000000000
Authorization: Bearer {{token}}
HTTP 404

# Forbidden: missing auth
GET http://127.0.0.1:3000/contas
HTTP 401

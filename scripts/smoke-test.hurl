# ── Health Smoke Test ────────────────────────────────────────────────────────

GET {{host}}/health/live
HTTP 200
[Asserts]
jsonpath "$.status" == "ok"

GET {{host}}/health/ready
HTTP 200
[Asserts]
jsonpath "$.status" == "ready"
jsonpath "$.services.database" == "ok"
jsonpath "$.services.mcp" exists

# ── MCP Metadata ─────────────────────────────────────────────────────────────
# This endpoint should respond if MCP is configured, which it is in production.
GET {{host}}/.well-known/oauth-protected-resource
HTTP 200

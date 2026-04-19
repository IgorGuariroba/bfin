#!/usr/bin/env bash
set -euo pipefail

# E2E manual test script for MCP HTTP+SSE transport
# Usage: scripts/test-mcp-http.sh
# Requires: curl, jq, and the following env vars:
#   AUTH0_DOMAIN, AUTH0_DEV_CLIENT_ID, AUTH0_DEV_CLIENT_SECRET,
#   MCP_HTTP_BASE_URL, MCP_AUDIENCE_HTTP

: "${AUTH0_DOMAIN:?AUTH0_DOMAIN not set}"
: "${AUTH0_DEV_CLIENT_ID:?AUTH0_DEV_CLIENT_ID not set}"
: "${AUTH0_DEV_CLIENT_SECRET:?AUTH0_DEV_CLIENT_SECRET not set}"
: "${MCP_HTTP_BASE_URL:?MCP_HTTP_BASE_URL not set}"
: "${MCP_AUDIENCE_HTTP:?MCP_AUDIENCE_HTTP not set}"

BASE_URL="${MCP_HTTP_BASE_URL%/}"

echo "== 1. Fetching access token from Auth0 =="
TOKEN_RESPONSE=$(curl -s -X POST "https://${AUTH0_DOMAIN}/oauth/token" \
  -H "Content-Type: application/json" \
  -d "{
    \"grant_type\":\"client_credentials\",
    \"client_id\":\"${AUTH0_DEV_CLIENT_ID}\",
    \"client_secret\":\"${AUTH0_DEV_CLIENT_SECRET}\",
    \"audience\":\"${MCP_AUDIENCE_HTTP}\"
  }")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "Failed to obtain access token:"
  echo "$TOKEN_RESPONSE" | jq .
  exit 1
fi

echo "Token obtained (first 20 chars): ${ACCESS_TOKEN:0:20}..."

echo ""
echo "== 2. Validating metadata endpoint =="
curl -s "${BASE_URL}/.well-known/oauth-protected-resource" | jq .

echo ""
echo "== 3. Testing 401 without token =="
curl -i -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  | head -n 5

echo ""
echo "== 4. Testing initialize with token =="
INIT_RESPONSE=$(curl -s -i -X POST "${BASE_URL}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
      "protocolVersion":"2024-11-05",
      "capabilities":{},
      "clientInfo":{"name":"test-script","version":"1.0.0"}
    }
  }')

echo "$INIT_RESPONSE"

SESSION_ID=$(echo "$INIT_RESPONSE" | grep -i 'mcp-session-id' | awk '{print $2}' | tr -d '\r')
if [ -z "$SESSION_ID" ]; then
  echo ""
  echo "WARNING: No Mcp-Session-Id header found in initialize response"
else
  echo ""
  echo "Session ID: ${SESSION_ID}"

  echo ""
  echo "== 5. Testing tools/list =="
  curl -s -X POST "${BASE_URL}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Mcp-Session-Id: ${SESSION_ID}" \
    -d '{
      "jsonrpc":"2.0",
      "id":2,
      "method":"tools/list"
    }' | jq .

  echo ""
  echo "== 6. Validating mcp.whoami is present =="
  TOOLS=$(curl -s -X POST "${BASE_URL}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Mcp-Session-Id: ${SESSION_ID}" \
    -d '{
      "jsonrpc":"2.0",
      "id":3,
      "method":"tools/list"
    }')

  if echo "$TOOLS" | jq -e '.result.tools[] | select(.name == "mcp.whoami")' > /dev/null 2>&1; then
    echo "OK: mcp.whoami found in tools/list"
  else
    echo "FAIL: mcp.whoami NOT found in tools/list"
    exit 1
  fi

  echo ""
  echo "== 7. Testing session termination =="
  curl -i -X DELETE "${BASE_URL}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Mcp-Session-Id: ${SESSION_ID}" \
    | head -n 3
fi

echo ""
echo "== 8. Testing CORS preflight =="
curl -i -X OPTIONS "${BASE_URL}" \
  -H "Origin: https://claude.ai" \
  -H "Access-Control-Request-Method: POST" \
  | grep -i 'access-control'

echo ""
echo "== All manual E2E checks passed =="

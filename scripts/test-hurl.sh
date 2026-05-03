#!/bin/sh
set -e

# Load local .env if present to pick up Auth0 credentials.
if [ -f .env ]; then
  # shellcheck disable=SC1091
  . ./.env
fi

# Map dev credentials to standard names used below.
if [ -z "$AUTH0_CLIENT_ID" ] && [ -n "$AUTH0_DEV_CLIENT_ID" ]; then
  AUTH0_CLIENT_ID="$AUTH0_DEV_CLIENT_ID"
fi
if [ -z "$AUTH0_CLIENT_SECRET" ] && [ -n "$AUTH0_DEV_CLIENT_SECRET" ]; then
  AUTH0_CLIENT_SECRET="$AUTH0_DEV_CLIENT_SECRET"
fi

# Prefer Auth0 client-credentials token if credentials are available.
TOKEN=""
if [ -n "$AUTH0_CLIENT_ID" ] && [ -n "$AUTH0_CLIENT_SECRET" ] && [ -n "$AUTH0_DOMAIN" ] && [ -n "$OIDC_AUDIENCE" ]; then
  TOKEN=$(curl -s -X POST "https://${AUTH0_DOMAIN}/oauth/token" \
    -H "Content-Type: application/json" \
    -d "{\"grant_type\":\"client_credentials\",\"client_id\":\"${AUTH0_CLIENT_ID}\",\"client_secret\":\"${AUTH0_CLIENT_SECRET}\",\"audience\":\"${OIDC_AUDIENCE}\"}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
fi

# Fallback to gcloud if Auth0 token not obtained.
if [ -z "$TOKEN" ]; then
  TOKEN=$(gcloud auth print-identity-token 2>/dev/null)
fi

if [ -z "$TOKEN" ]; then
  echo "ERROR: No valid token obtained."
  echo "Set AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_DOMAIN, OIDC_AUDIENCE or run: gcloud auth login"
  exit 1
fi

RUN_ID=$(date +%s)

hurl \
  --variable "token=$TOKEN" \
  --variable "runId=$RUN_ID" \
  --test \
  .hurl/e2e.hurl

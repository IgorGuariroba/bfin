#!/bin/sh
set -e

TOKEN=$(gcloud auth print-identity-token 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "ERROR: gcloud auth print-identity-token failed. Run: gcloud auth login"
  exit 1
fi

RUN_ID=$(date +%s)

hurl \
  --variable "token=$TOKEN" \
  --variable "runId=$RUN_ID" \
  --test \
  .hurl/e2e.hurl

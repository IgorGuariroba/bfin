# OIDC Migration: Google → Auth0

## Overview

The API HTTP issuer has been migrated from Google OIDC to Auth0 to unify with the MCP server authentication and support the Next.js web frontend.

## Changes

- `OIDC_AUDIENCE` is now **required**.
- Tokens must include `aud` claim matching the configured audience.
- `findOrCreateUser` supports re-linking by email when `email_verified === true`.
- Existing users with Google tokens will be automatically re-linked on first login with Auth0 (same email required).

## Auth0 Setup

1. Create an API identifier in your Auth0 tenant (e.g. `https://api.bfincont.com.br`).
2. Set `OIDC_ISSUER_URL` to your Auth0 domain (e.g. `https://bfin.us.auth0.com`).
3. Set `OIDC_AUDIENCE` to the API identifier.

## Environment Variables

| Variable | Old Value | New Value |
|---|---|---|
| `OIDC_ISSUER_URL` | `https://accounts.google.com` | `https://<tenant>.auth0.com` |
| `OIDC_AUDIENCE` | optional | required (API identifier) |

## Rollback

Revert `OIDC_ISSUER_URL` to `https://accounts.google.com` and remove `OIDC_AUDIENCE`. The `findOrCreateUser` service will create new user records for Google `sub` values that differ from Auth0, but existing data remains intact.

## Release Notes

- All users must re-login after cutover (tokens are not interchangeable).
- Maintenance window: ~5 minutes for env rotation and redeploy.
- Monitor auth logs for 24h after production promotion.

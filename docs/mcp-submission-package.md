# MCP Submission Package — Anthropic Connectors Directory

## Checklist

- [x] **Privacy policy URL**: https://api.bfincont.com.br/privacy
- [x] **Documentation URL**: https://github.com/IgorGuariroba/bfin/blob/master/docs/mcp.md
- [x] **Demo credentials**: `mcp-review@bfincont.com.br` — password stored in 1Password vault "BFin".
- [x] **Logo (light)**: `docs/branding/logo.svg`
- [x] **Logo (dark)**: `docs/branding/logo-dark.svg`
- [x] **Favicon**: `docs/branding/favicon.ico` + `docs/branding/favicon-32.png`
- [x] **Screenshots**: `docs/branding/screenshots/*.png` (3-5 captures at 1280×800)
- [x] **Tagline**: `docs/branding/tagline.txt` (≤80 chars)
- [x] **Short description**: `docs/branding/desc-short.txt` (≤140 chars)
- [x] **Long description**: `docs/branding/desc-long.md` (≤2000 chars)
- [x] **Transport protocol**: HTTP+SSE (Remote MCP)
- [x] **Allowed redirect URIs**: `https://claude.ai/auth/callback`, `https://app.claude.com/auth/callback`
- [x] **MCP endpoint**: https://api.bfincont.com.br/mcp
- [x] **OAuth Authorization Server**: Auth0 (https://bfin.us.auth0.com)
- [x] **OAuth flow**: Authorization Code + PKCE, dynamic client registration (DCR)

## Demo Account Details

| Field | Value |
|---|---|
| Email | `mcp-review@bfincont.com.br` |
| Password | See 1Password vault "BFin" |
| MFA | Disabled |
| Scopes | Full read+write+delete |
| Dataset | 2 accounts, ~30 transactions, 1 debt (12x), 1 goal, 1 projection |
| Reset window | 03:00 BRT daily |

## Verification

Run before submitting:

```bash
npm run mcp:check-submission
```

This validates the existence of every file and URL referenced above.

## Notes for Reviewers

- The MCP server uses OAuth 2.1 (RFC 9728 metadata discovery at `/.well-known/oauth-protected-resource`).
- The demo account is isolated: real users cannot be linked to the demo account ID.
- All tools emit structured errors (`INVALID_INPUT`, `NOT_FOUND`, `FORBIDDEN`, `BUSINESS_RULE`, `INTERNAL`).
- Rate limiting is per-user (`sub`) to prevent abuse.

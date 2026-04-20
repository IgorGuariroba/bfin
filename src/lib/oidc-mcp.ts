import { createJwtVerifier, JwtValidationError } from "./oidc-jwks.js";

export interface McpClaims {
  sub: string;
  email: string | undefined;
  name: string | undefined;
  scopes: Set<string>;
  exp: number | undefined;
}

export interface McpJwtVerifier {
  verify(token: string): Promise<McpClaims>;
  readonly issuer: string;
}

function extractScopes(payload: {
  scope?: unknown;
  permissions?: unknown;
}): Set<string> {
  const out = new Set<string>();

  if (typeof payload.scope === "string") {
    for (const s of payload.scope.split(/\s+/)) {
      const t = s.trim();
      if (t?.includes(":")) out.add(t);
    }
  }

  if (Array.isArray(payload.permissions)) {
    for (const p of payload.permissions) {
      if (typeof p === "string" && p.includes(":")) out.add(p);
    }
  }

  return out;
}

export async function createMcpJwtVerifier(params: {
  issuerUrl: string;
  audience: string;
}): Promise<McpJwtVerifier> {
  const inner = await createJwtVerifier({
    issuerUrl: params.issuerUrl,
    audience: params.audience,
    clientIdForDiscovery: "bfin-mcp-http",
  });

  return {
    issuer: inner.issuer,
    async verify(token: string): Promise<McpClaims> {
      const payload = await inner.verify(token);
      const sub = typeof payload.sub === "string" ? payload.sub : undefined;
      if (!sub) {
        throw new JwtValidationError("Token missing 'sub' claim", "TOKEN_INVALID");
      }
      // Auth0 may silently strip standard OIDC claims (email, name) from
      // access tokens and require namespaced custom claims. Accept either.
      const namespacedEmail = (payload as Record<string, unknown>)[
        "https://bfincont.com.br/email"
      ];
      const namespacedName = (payload as Record<string, unknown>)[
        "https://bfincont.com.br/name"
      ];
      return {
        sub,
        email:
          typeof payload.email === "string"
            ? payload.email
            : typeof namespacedEmail === "string"
              ? namespacedEmail
              : undefined,
        name:
          typeof payload.name === "string"
            ? payload.name
            : typeof namespacedName === "string"
              ? namespacedName
              : undefined,
        scopes: extractScopes(payload as { scope?: unknown; permissions?: unknown }),
        exp: typeof payload.exp === "number" ? payload.exp : undefined,
      };
    },
  };
}

export { JwtValidationError } from "./oidc-jwks.js";

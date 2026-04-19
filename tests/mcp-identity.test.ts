import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  loadServiceAccountFromToken,
  parseScopes,
  ServiceAccountBootstrapError,
} from "../src/mcp/identity.js";
import {
  JwtValidationError,
  type McpClaims,
  type McpJwtVerifier,
} from "../src/lib/oidc-mcp.js";
import { mcpLogger } from "../src/mcp/logger.js";

function fakeVerifier(
  result: McpClaims | JwtValidationError
): McpJwtVerifier {
  return {
    issuer: "https://test-issuer.example.com/",
    async verify() {
      if (result instanceof JwtValidationError) throw result;
      return result;
    },
  };
}

function claims(overrides: Partial<McpClaims> = {}): McpClaims {
  return {
    sub: "auth0|abc",
    email: undefined,
    name: undefined,
    scopes: new Set<string>(),
    exp: undefined,
    ...overrides,
  };
}

describe("parseScopes", () => {
  it("returns empty set for non-string input", () => {
    expect(parseScopes(undefined).size).toBe(0);
    expect(parseScopes(42).size).toBe(0);
  });

  it("parses valid space-separated scopes", () => {
    const s = parseScopes("accounts:read transactions:write");
    expect(s.has("accounts:read")).toBe(true);
    expect(s.has("transactions:write")).toBe(true);
    expect(s.size).toBe(2);
  });

  it("discards malformed scopes", () => {
    const s = parseScopes("accounts:read admin transactions:write");
    expect(s.has("admin")).toBe(false);
    expect(s.size).toBe(2);
  });
});

describe("loadServiceAccountFromToken", () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp({
      validateToken: async () => ({ sub: "not-used" }),
    });
    await testApp.truncateAll();
  });

  afterEach(async () => {
    await testApp?.teardown();
  });

  async function insertUser(idProvedor: string): Promise<string> {
    const [row] = await testApp.client`
      INSERT INTO usuarios (id_provedor, nome, email)
      VALUES (${idProvedor}, 'Test User', 'user@example.com')
      RETURNING id
    `;
    return row.id as string;
  }

  it("returns a frozen ServiceAccount with parsed scopes for existing user", async () => {
    const userId = await insertUser("auth0|abc");
    const sa = await loadServiceAccountFromToken({
      token: "fake",
      verifier: fakeVerifier(
        claims({
          sub: "auth0|abc",
          scopes: new Set(["accounts:read", "transactions:write"]),
          exp: 9_999_999_999,
        })
      ),
      provisioning: { allowlistRaw: undefined, logger: mcpLogger },
    });

    expect(sa.subject).toBe("auth0|abc");
    expect(sa.actingUserId).toBe(userId);
    expect(sa.tokenExp).toBe(9_999_999_999);
    expect(sa.scopes.has("accounts:read")).toBe(true);
    expect(Object.isFrozen(sa)).toBe(true);
  });

  it("throws TOKEN_EXPIRED when verifier reports expired", async () => {
    await expect(
      loadServiceAccountFromToken({
        token: "x",
        verifier: fakeVerifier(new JwtValidationError("expired", "TOKEN_EXPIRED")),
        provisioning: { allowlistRaw: undefined },
      })
    ).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
  });

  it("throws TOKEN_INVALID on verifier failure", async () => {
    await expect(
      loadServiceAccountFromToken({
        token: "x",
        verifier: fakeVerifier(new JwtValidationError("bad sig", "TOKEN_INVALID")),
        provisioning: { allowlistRaw: undefined },
      })
    ).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("throws USER_NOT_FOUND when sub is unknown and no allowlist", async () => {
    await expect(
      loadServiceAccountFromToken({
        token: "x",
        verifier: fakeVerifier(claims({ sub: "auth0|unknown", email: "x@e.com" })),
        provisioning: { allowlistRaw: undefined },
      })
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("throws USER_NOT_FOUND when email is outside allowlist", async () => {
    await expect(
      loadServiceAccountFromToken({
        token: "x",
        verifier: fakeVerifier(
          claims({ sub: "auth0|new", email: "stranger@example.com" })
        ),
        provisioning: { allowlistRaw: "only@allowed.com" },
      })
    ).rejects.toBeInstanceOf(ServiceAccountBootstrapError);
  });

  it("provisions new user when email matches allowlist", async () => {
    const sa = await loadServiceAccountFromToken({
      token: "x",
      verifier: fakeVerifier(
        claims({
          sub: "auth0|new",
          email: "new@allowed.com",
          name: "New User",
          scopes: new Set(["accounts:read"]),
        })
      ),
      provisioning: { allowlistRaw: "new@allowed.com" },
    });

    expect(sa.subject).toBe("auth0|new");
    const [row] = await testApp.client`
      SELECT id, nome FROM usuarios WHERE id_provedor = 'auth0|new'
    `;
    expect(row.id).toBe(sa.actingUserId);
    expect(row.nome).toBe("New User");
  });
});

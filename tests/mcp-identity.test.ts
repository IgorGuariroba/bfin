import { describe, it, expect, afterEach, beforeEach } from "vitest";
import type { JWTPayload } from "jose";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  loadServiceAccount,
  parseScopes,
  ServiceAccountBootstrapError,
} from "../src/mcp/identity.js";
import { JwtValidationError, type JwtVerifier } from "../src/lib/oidc-jwks.js";

function fakeVerifier(payloadOrError: JWTPayload | JwtValidationError): JwtVerifier {
  return {
    issuer: "https://test-issuer.example.com/",
    async verify() {
      if (payloadOrError instanceof JwtValidationError) {
        throw payloadOrError;
      }
      return payloadOrError;
    },
  };
}

describe("parseScopes", () => {
  it("returns empty set for non-string input", () => {
    expect(parseScopes(undefined).size).toBe(0);
    expect(parseScopes(null).size).toBe(0);
    expect(parseScopes(42).size).toBe(0);
  });

  it("parses valid space-separated scopes", () => {
    const s = parseScopes("accounts:read transactions:write");
    expect(s.has("accounts:read")).toBe(true);
    expect(s.has("transactions:write")).toBe(true);
    expect(s.size).toBe(2);
  });

  it("discards items without ':'", () => {
    const s = parseScopes("accounts:read admin transactions:write");
    expect(s.has("admin")).toBe(false);
    expect(s.size).toBe(2);
  });

  it("returns empty set when scope is empty string", () => {
    expect(parseScopes("").size).toBe(0);
  });
});

describe("loadServiceAccount", () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp({});
    await testApp.truncateAll();
  });

  afterEach(async () => {
    await testApp?.teardown();
  });

  async function insertUser(): Promise<string> {
    const [row] = await testApp.client`
      INSERT INTO usuarios (id_provedor, nome, email)
      VALUES ('sa-bootstrap', 'SA Bootstrap', 'sa@example.com')
      RETURNING id
    `;
    return row.id as string;
  }

  it("returns a frozen ServiceAccount with parsed scopes", async () => {
    const userId = await insertUser();
    const sa = await loadServiceAccount({
      mcpConfig: {
        oidcAudience: "bfin-mcp",
        serviceAccountToken: "dummy",
        subjectUserId: userId,
      },
      verifier: fakeVerifier({
        sub: "sa-subject",
        scope: "accounts:read transactions:write",
        exp: 9_999_999_999,
      }),
    });

    expect(sa.subject).toBe("sa-subject");
    expect(sa.actingUserId).toBe(userId);
    expect(sa.tokenExp).toBe(9_999_999_999);
    expect(sa.scopes.has("accounts:read")).toBe(true);
    expect(sa.scopes.has("transactions:write")).toBe(true);
    expect(Object.isFrozen(sa)).toBe(true);
  });

  it("empty scopes set when scope claim is absent", async () => {
    const userId = await insertUser();
    const sa = await loadServiceAccount({
      mcpConfig: {
        oidcAudience: "bfin-mcp",
        serviceAccountToken: "dummy",
        subjectUserId: userId,
      },
      verifier: fakeVerifier({ sub: "sa-subject" }),
    });
    expect(sa.scopes.size).toBe(0);
  });

  it("mixed valid + malformed scopes keeps only valid", async () => {
    const userId = await insertUser();
    const sa = await loadServiceAccount({
      mcpConfig: {
        oidcAudience: "bfin-mcp",
        serviceAccountToken: "dummy",
        subjectUserId: userId,
      },
      verifier: fakeVerifier({
        sub: "sa-subject",
        scope: "accounts:read badscope transactions:write",
      }),
    });
    expect(sa.scopes.has("accounts:read")).toBe(true);
    expect(sa.scopes.has("transactions:write")).toBe(true);
    expect(sa.scopes.has("badscope")).toBe(false);
  });

  it("throws TOKEN_EXPIRED when verifier reports expired", async () => {
    const userId = await insertUser();
    await expect(
      loadServiceAccount({
        mcpConfig: {
          oidcAudience: "bfin-mcp",
          serviceAccountToken: "dummy",
          subjectUserId: userId,
        },
        verifier: fakeVerifier(new JwtValidationError("expired", "TOKEN_EXPIRED")),
      })
    ).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
  });

  it("throws TOKEN_INVALID when audience fails", async () => {
    const userId = await insertUser();
    await expect(
      loadServiceAccount({
        mcpConfig: {
          oidcAudience: "bfin-mcp",
          serviceAccountToken: "dummy",
          subjectUserId: userId,
        },
        verifier: fakeVerifier(new JwtValidationError("bad aud", "TOKEN_INVALID")),
      })
    ).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("throws USER_NOT_FOUND when subject user does not exist", async () => {
    await expect(
      loadServiceAccount({
        mcpConfig: {
          oidcAudience: "bfin-mcp",
          serviceAccountToken: "dummy",
          subjectUserId: "00000000-0000-0000-0000-000000000000",
        },
        verifier: fakeVerifier({ sub: "sa", scope: "accounts:read" }),
      })
    ).rejects.toBeInstanceOf(ServiceAccountBootstrapError);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp, type TestApp } from "./helpers/setup.js";
import {
  JwtValidationError,
  type McpClaims,
  type McpJwtVerifier,
} from "../src/lib/oidc-mcp.js";

const BASE_URL = "https://api.test.local/mcp";

function buildVerifier(
  tokenMap: Record<string, McpClaims | JwtValidationError>
): McpJwtVerifier {
  return {
    issuer: "https://test-issuer.example.com/",
    async verify(token: string) {
      const entry = tokenMap[token];
      if (!entry) throw new JwtValidationError("unknown token", "TOKEN_INVALID");
      if (entry instanceof JwtValidationError) throw entry;
      return entry;
    },
  };
}

describe("MCP HTTP plugin", () => {
  let testApp: TestApp;
  let userId: string;

  beforeEach(async () => {
    const verifier = buildVerifier({
      "valid-token": {
        sub: "auth0|int",
        email: "int@test.local",
        name: "Int Test",
        scopes: new Set(["accounts:read", "transactions:read"]),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      "expired-token": new JwtValidationError("expired", "TOKEN_EXPIRED"),
      "bad-token": new JwtValidationError("bad sig", "TOKEN_INVALID"),
    });

    testApp = await createTestApp({
      validateToken: async () => ({ sub: "not-used" }),
      mcpHttpOptions: {
        config: {
          enabled: true,
          baseUrl: BASE_URL,
          audience: "https://mcp.test.local",
          authServerUrl: "https://auth.test.local",
          provisioningAllowedEmails: undefined,
          sessionStore: "memory",
        },
        verifier,
      },
    });
    await testApp.truncateAll();
    const [row] = await testApp.client`
      INSERT INTO usuarios (id_provedor, nome, email)
      VALUES ('auth0|int', 'Int Test', 'int@test.local')
      RETURNING id
    `;
    userId = row.id as string;
  });

  afterEach(async () => {
    await testApp?.teardown().catch(() => {});
  });

  function postInitialize(token: string | undefined) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };
    if (token) headers.authorization = `Bearer ${token}`;
    return testApp.app.inject({
      method: "POST",
      url: "/mcp",
      headers,
      payload: { jsonrpc: "2.0", id: 1, method: "initialize" },
    });
  }

  it("GET /mcp/.well-known/oauth-protected-resource returns RFC 9728 metadata", async () => {
    const res = await testApp.app.inject({
      method: "GET",
      url: "/mcp/.well-known/oauth-protected-resource",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.resource).toBe(BASE_URL);
    expect(body.authorization_servers).toEqual(["https://auth.test.local"]);
    expect(body.bearer_methods_supported).toEqual(["header"]);
    expect(Array.isArray(body.scopes_supported)).toBe(true);
    expect(body.scopes_supported).toContain("accounts:read");
  });

  it("POST /mcp without Bearer returns 401 with WWW-Authenticate", async () => {
    const res = await postInitialize(undefined);
    expect(res.statusCode).toBe(401);
    expect(res.headers["www-authenticate"]).toContain(
      `resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`
    );
    expect(res.headers["www-authenticate"]).toContain('error="invalid_token"');
  });

  it("POST /mcp with invalid token returns 401", async () => {
    const res = await postInitialize("bad-token");
    expect(res.statusCode).toBe(401);
    expect(res.headers["www-authenticate"]).toContain('error="invalid_token"');
  });

  it("POST /mcp with expired token returns 401 with expired_token error", async () => {
    const res = await postInitialize("expired-token");
    expect(res.statusCode).toBe(401);
    expect(res.headers["www-authenticate"]).toContain('error="expired_token"');
  });

  it("POST /mcp with valid token and initialize returns a session id", async () => {
    const res = await testApp.app.inject({
      method: "POST",
      url: "/mcp",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      payload: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const sessionId = res.headers["mcp-session-id"];
    expect(typeof sessionId).toBe("string");
    expect(sessionId).toMatch(/[0-9a-f-]{36}/i);
    expect(userId).toBeTruthy();
  });

  it("GET /mcp without session header returns 400", async () => {
    const res = await testApp.app.inject({
      method: "GET",
      url: "/mcp",
      headers: {
        authorization: "Bearer valid-token",
        accept: "text/event-stream",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Missing Mcp-Session-Id header");
  });

  it("GET /mcp with non-existent session returns 404", async () => {
    const res = await testApp.app.inject({
      method: "GET",
      url: "/mcp",
      headers: {
        authorization: "Bearer valid-token",
        accept: "text/event-stream",
        "mcp-session-id": "00000000-0000-0000-0000-000000000000",
      },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Session not found");
  });

  it("DELETE /mcp without session header returns 400", async () => {
    const res = await testApp.app.inject({
      method: "DELETE",
      url: "/mcp",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("DELETE /mcp with non-existent session returns 204", async () => {
    const res = await testApp.app.inject({
      method: "DELETE",
      url: "/mcp",
      headers: {
        authorization: "Bearer valid-token",
        "mcp-session-id": "00000000-0000-0000-0000-000000000000",
      },
    });
    expect(res.statusCode).toBe(204);
  });

  it("CORS headers are set for allowed origin", async () => {
    const res = await testApp.app.inject({
      method: "OPTIONS",
      url: "/mcp",
      headers: {
        origin: "https://claude.ai",
        "access-control-request-method": "POST",
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://claude.ai");
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("CORS headers are set for localhost", async () => {
    const res = await testApp.app.inject({
      method: "OPTIONS",
      url: "/mcp",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "POST",
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("CORS headers are NOT set for unknown origin", async () => {
    const res = await testApp.app.inject({
      method: "OPTIONS",
      url: "/mcp",
      headers: {
        origin: "https://evil.example.com",
        "access-control-request-method": "POST",
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("well-known metadata is rate limited", async () => {
    const requests = Array.from({ length: 61 }, () =>
      testApp.app.inject({
        method: "GET",
        url: "/mcp/.well-known/oauth-protected-resource",
      })
    );
    const results = await Promise.all(requests);
    const tooMany = results.filter((r) => r.statusCode === 429);
    expect(tooMany.length).toBeGreaterThan(0);
  });
});

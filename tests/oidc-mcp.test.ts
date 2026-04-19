import { describe, it, expect, vi } from "vitest";
import { createMcpJwtVerifier, type McpClaims } from "../src/lib/oidc-mcp.js";
import { JwtValidationError } from "../src/lib/oidc-jwks.js";

vi.mock("../src/lib/oidc-jwks.js", () => ({
  createJwtVerifier: vi.fn(),
  JwtValidationError: class extends Error {
    code: string;
    constructor(msg: string, code: string) {
      super(msg);
      this.code = code;
      this.name = "JwtValidationError";
    }
  },
}));

describe("createMcpJwtVerifier", () => {
  it("extracts claims from a valid JWT payload", async () => {
    const { createJwtVerifier } = await import("../src/lib/oidc-jwks.js");
    const mockVerify = vi.fn().mockResolvedValue({
      sub: "user-123",
      email: "user@example.com",
      name: "Test User",
      scope: "transactions:read transactions:write",
      exp: 1700000000,
    });
    vi.mocked(createJwtVerifier).mockResolvedValue({
      verify: mockVerify,
      issuer: "https://auth.example.com",
    } as any);

    const verifier = await createMcpJwtVerifier({
      issuerUrl: "https://auth.example.com",
      audience: "bfin-mcp",
    });

    const claims = await verifier.verify("valid.jwt.token");
    expect(claims.sub).toBe("user-123");
    expect(claims.email).toBe("user@example.com");
    expect(claims.name).toBe("Test User");
    expect(claims.scopes.has("transactions:read")).toBe(true);
    expect(claims.scopes.has("transactions:write")).toBe(true);
    expect(claims.exp).toBe(1700000000);
  });

  it("throws JwtValidationError when sub is missing", async () => {
    const { createJwtVerifier } = await import("../src/lib/oidc-jwks.js");
    const mockVerify = vi.fn().mockResolvedValue({
      email: "user@example.com",
    });
    vi.mocked(createJwtVerifier).mockResolvedValue({
      verify: mockVerify,
      issuer: "https://auth.example.com",
    } as any);

    const verifier = await createMcpJwtVerifier({
      issuerUrl: "https://auth.example.com",
      audience: "bfin-mcp",
    });

    await expect(verifier.verify("token-without-sub")).rejects.toThrow("Token missing 'sub' claim");
  });

  it("extracts scopes from permissions array", async () => {
    const { createJwtVerifier } = await import("../src/lib/oidc-jwks.js");
    const mockVerify = vi.fn().mockResolvedValue({
      sub: "user-456",
      permissions: ["accounts:read", "categories:read", "no-colon-skip"],
    });
    vi.mocked(createJwtVerifier).mockResolvedValue({
      verify: mockVerify,
      issuer: "https://auth.example.com",
    } as any);

    const verifier = await createMcpJwtVerifier({
      issuerUrl: "https://auth.example.com",
      audience: "bfin-mcp",
    });

    const claims = await verifier.verify("token");
    expect(claims.scopes.has("accounts:read")).toBe(true);
    expect(claims.scopes.has("categories:read")).toBe(true);
    expect(claims.scopes.has("no-colon-skip")).toBe(false);
  });

  it("handles empty scope and permissions", async () => {
    const { createJwtVerifier } = await import("../src/lib/oidc-jwks.js");
    const mockVerify = vi.fn().mockResolvedValue({
      sub: "user-789",
    });
    vi.mocked(createJwtVerifier).mockResolvedValue({
      verify: mockVerify,
      issuer: "https://auth.example.com",
    } as any);

    const verifier = await createMcpJwtVerifier({
      issuerUrl: "https://auth.example.com",
      audience: "bfin-mcp",
    });

    const claims = await verifier.verify("token");
    expect(claims.scopes.size).toBe(0);
  });

  it("reports correct issuer", async () => {
    const { createJwtVerifier } = await import("../src/lib/oidc-jwks.js");
    vi.mocked(createJwtVerifier).mockResolvedValue({
      verify: vi.fn(),
      issuer: "https://auth.example.com",
    } as any);

    const verifier = await createMcpJwtVerifier({
      issuerUrl: "https://auth.example.com",
      audience: "bfin-mcp",
    });

    expect(verifier.issuer).toBe("https://auth.example.com");
  });

  it("handles non-string sub gracefully", async () => {
    const { createJwtVerifier } = await import("../src/lib/oidc-jwks.js");
    const mockVerify = vi.fn().mockResolvedValue({
      sub: 12345,
    });
    vi.mocked(createJwtVerifier).mockResolvedValue({
      verify: mockVerify,
      issuer: "https://auth.example.com",
    } as any);

    const verifier = await createMcpJwtVerifier({
      issuerUrl: "https://auth.example.com",
      audience: "bfin-mcp",
    });

    await expect(verifier.verify("token")).rejects.toThrow("Token missing 'sub' claim");
  });
});

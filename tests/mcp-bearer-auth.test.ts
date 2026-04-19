import { describe, it, expect } from "vitest";
import type { FastifyRequest } from "fastify";
import {
  buildWwwAuthenticateHeader,
  extractBearerToken,
} from "../src/mcp/oauth/bearer-auth.js";

function req(headers: Record<string, string | undefined>): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

describe("extractBearerToken", () => {
  it("returns null when Authorization header missing", () => {
    expect(extractBearerToken(req({}))).toBeNull();
  });

  it("returns null for malformed headers", () => {
    expect(extractBearerToken(req({ authorization: "Basic xyz" }))).toBeNull();
    expect(extractBearerToken(req({ authorization: "Bearer" }))).toBeNull();
    expect(extractBearerToken(req({ authorization: "" }))).toBeNull();
  });

  it("extracts token with case-insensitive scheme", () => {
    expect(extractBearerToken(req({ authorization: "Bearer abc.def.ghi" }))).toBe(
      "abc.def.ghi"
    );
    expect(extractBearerToken(req({ authorization: "bearer abc.def.ghi" }))).toBe(
      "abc.def.ghi"
    );
    expect(extractBearerToken(req({ authorization: "BEARER abc.def.ghi" }))).toBe(
      "abc.def.ghi"
    );
  });

  it("trims surrounding whitespace", () => {
    expect(
      extractBearerToken(req({ authorization: "  Bearer   xyz  " }))
    ).toBe("xyz");
  });
});

describe("buildWwwAuthenticateHeader", () => {
  it("emits resource_metadata URL without error param by default", () => {
    expect(buildWwwAuthenticateHeader("https://api.bfincont.com.br/mcp")).toBe(
      'Bearer resource_metadata="https://api.bfincont.com.br/mcp/.well-known/oauth-protected-resource"'
    );
  });

  it("includes error param when provided", () => {
    expect(
      buildWwwAuthenticateHeader("https://api.bfincont.com.br/mcp", "invalid_token")
    ).toContain('error="invalid_token"');
  });

  it("normalizes trailing slash in the resource URL", () => {
    expect(buildWwwAuthenticateHeader("https://x/mcp/")).toBe(
      'Bearer resource_metadata="https://x/mcp/.well-known/oauth-protected-resource"'
    );
  });
});

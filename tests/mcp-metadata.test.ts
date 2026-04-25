import { describe, it, expect } from "vitest";
import {
  buildProtectedResourceMetadata,
  collectScopes,
} from "../src/mcp/oauth/metadata.js";
import type { ToolRegistry } from "../src/mcp/tool-types.js";
import type { McpToolAny } from "../src/mcp/tool-types.js";

function fakeRegistry(scopes: (string | undefined)[]): ToolRegistry {
  const tools = scopes.map(
    (s, i) =>
      ({
        name: `tool-${i}`,
        description: "x",
        requiredScope: s,
        inputSchema: { parse: (v: unknown) => v } as never,
        handler: async () => null,
      }) as unknown as McpToolAny
  );
  return {
    get: () => undefined,
    listVisible: () => [],
    all: () => tools,
  };
}

describe("collectScopes", () => {
  it("returns unique sorted scopes, skipping tools without one", () => {
    const reg = fakeRegistry([
      "accounts:read",
      "transactions:write",
      undefined,
      "accounts:read",
    ]);
    expect(collectScopes(reg)).toEqual(["accounts:read", "transactions:write"]);
  });
});

describe("buildProtectedResourceMetadata", () => {
  it("produces RFC 9728 shape with values from config", () => {
    const meta = buildProtectedResourceMetadata({
      config: {
        enabled: true,
        baseUrl: "https://api.bfincont.com.br/mcp",
        audience: "https://mcp.bfincont.com.br",
        authServerUrl: "https://bfin.us.auth0.com",
        provisioningAllowedEmails: undefined,
        sessionStore: "memory",
      },
      scopes: ["accounts:read", "transactions:write"],
    });

    expect(meta.resource).toBe("https://api.bfincont.com.br/mcp");
    expect(meta.authorization_servers).toEqual(["https://bfin.us.auth0.com"]);
    expect(meta.bearer_methods_supported).toEqual(["header"]);
    expect(meta.scopes_supported).toEqual([
      "accounts:read",
      "transactions:write",
    ]);
    expect(meta.resource_documentation).toBe(
      "https://github.com/IgorGuariroba/bfin/blob/master/docs/mcp.md"
    );
  });
});

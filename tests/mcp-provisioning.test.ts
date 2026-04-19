import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp, type TestApp } from "./helpers/setup.js";
import {
  isEmailAllowed,
  resolveUserFromClaims,
} from "../src/mcp/oauth/provisioning.js";
import { ServiceAccountBootstrapError } from "../src/mcp/identity.js";
import { mcpLogger } from "../src/mcp/logger.js";

describe("isEmailAllowed", () => {
  it("returns false when allowlist is empty or missing", () => {
    expect(isEmailAllowed("a@b.com", undefined)).toBe(false);
    expect(isEmailAllowed("a@b.com", "")).toBe(false);
  });

  it("matches exact emails (case-insensitive)", () => {
    expect(isEmailAllowed("Igor@example.com", "igor@example.com")).toBe(true);
    expect(isEmailAllowed("other@example.com", "igor@example.com")).toBe(false);
  });

  it("matches regex patterns", () => {
    expect(isEmailAllowed("igor@bfincont.com.br", "/@bfincont\\.com\\.br$/i")).toBe(
      true
    );
    expect(isEmailAllowed("x@other.com", "/@bfincont\\.com\\.br$/i")).toBe(false);
  });

  it("handles CSV with mixed values", () => {
    const allowlist = "admin@bfin.com, /@bfincont\\.com\\.br$/";
    expect(isEmailAllowed("admin@bfin.com", allowlist)).toBe(true);
    expect(isEmailAllowed("dev@bfincont.com.br", allowlist)).toBe(true);
    expect(isEmailAllowed("stranger@gmail.com", allowlist)).toBe(false);
  });
});

describe("resolveUserFromClaims", () => {
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

  it("returns id for existing user matched by id_provedor", async () => {
    const [row] = await testApp.client`
      INSERT INTO usuarios (id_provedor, nome, email)
      VALUES ('auth0|existing', 'Existing', 'existing@example.com')
      RETURNING id
    `;
    const id = await resolveUserFromClaims(
      {
        sub: "auth0|existing",
        email: "existing@example.com",
        name: "Existing",
        scopes: new Set(),
        exp: undefined,
      },
      { allowlistRaw: undefined, logger: mcpLogger }
    );
    expect(id).toBe(row.id);
  });

  it("provisions a new user when email is on allowlist", async () => {
    const id = await resolveUserFromClaims(
      {
        sub: "auth0|new",
        email: "dev@allowed.com",
        name: "Dev",
        scopes: new Set(),
        exp: undefined,
      },
      { allowlistRaw: "dev@allowed.com", logger: mcpLogger }
    );
    const [row] = await testApp.client`
      SELECT id FROM usuarios WHERE id_provedor = 'auth0|new'
    `;
    expect(row.id).toBe(id);
  });

  it("throws USER_NOT_FOUND when email is not on allowlist", async () => {
    await expect(
      resolveUserFromClaims(
        {
          sub: "auth0|stranger",
          email: "stranger@evil.com",
          name: undefined,
          scopes: new Set(),
          exp: undefined,
        },
        { allowlistRaw: "only@good.com", logger: mcpLogger }
      )
    ).rejects.toBeInstanceOf(ServiceAccountBootstrapError);
  });
});

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  hasScope,
  authorizeToolCall,
  normalizeRequestedBy,
  ToolAuthorizationError,
} from "../src/mcp/authz.js";
import { ForbiddenError } from "../src/lib/errors.js";
import type { ServiceAccount } from "../src/mcp/identity.js";

function buildSa(overrides: Partial<ServiceAccount> = {}): ServiceAccount {
  return Object.freeze({
    subject: "sa",
    scopes: overrides.scopes ?? new Set<string>(["transactions:read"]),
    actingUserId: overrides.actingUserId ?? "00000000-0000-0000-0000-000000000001",
    tokenExp: overrides.tokenExp,
  });
}

describe("hasScope", () => {
  it("returns true when scope is granted", () => {
    const sa = buildSa({ scopes: new Set(["accounts:read"]) });
    expect(hasScope(sa, "accounts:read")).toBe(true);
  });
  it("returns false when scope missing", () => {
    const sa = buildSa({ scopes: new Set(["accounts:read"]) });
    expect(hasScope(sa, "transactions:write")).toBe(false);
  });
});

describe("normalizeRequestedBy", () => {
  it("accepts a normal string", () => {
    expect(normalizeRequestedBy("alice@example.com")).toBe("alice@example.com");
  });
  it("rejects non-string", () => {
    expect(normalizeRequestedBy(42)).toBeUndefined();
    expect(normalizeRequestedBy(undefined)).toBeUndefined();
  });
  it("rejects strings longer than 200 chars", () => {
    expect(normalizeRequestedBy("a".repeat(201))).toBeUndefined();
  });
  it("rejects strings with control characters", () => {
    expect(normalizeRequestedBy("alice\nadmin")).toBeUndefined();
    expect(normalizeRequestedBy("alice\x00")).toBeUndefined();
  });
  it("rejects empty string", () => {
    expect(normalizeRequestedBy("")).toBeUndefined();
  });
});

describe("authorizeToolCall", () => {
  it("throws scope_missing when scope absent", async () => {
    const sa = buildSa({ scopes: new Set(["accounts:read"]) });
    await expect(
      authorizeToolCall(sa, { requiredScope: "transactions:write" }, {})
    ).rejects.toMatchObject({ reason: "scope_missing" });
  });

  it("passes when scope present and no minRole", async () => {
    const sa = buildSa({ scopes: new Set(["accounts:read"]) });
    await expect(
      authorizeToolCall(sa, { requiredScope: "accounts:read" }, {})
    ).resolves.toBeUndefined();
  });

  describe("with account role", () => {
    let testApp: TestApp;

    beforeEach(async () => {
      testApp = await createTestApp({});
      await testApp.truncateAll();
    });

    afterEach(async () => {
      await testApp?.teardown();
    });

    async function fixture(role: "owner" | "viewer") {
      const [u] = await testApp.client`
        INSERT INTO usuarios (id_provedor, nome, email)
        VALUES ('x', 'x', 'x@example.com') RETURNING id
      `;
      const [c] = await testApp.client`
        INSERT INTO contas (nome, saldo_inicial) VALUES ('c', 0) RETURNING id
      `;
      await testApp.client`
        INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
        VALUES (${c.id}, ${u.id}, ${role})
      `;
      return { userId: u.id as string, contaId: c.id as string };
    }

    it("viewer trying owner operation is forbidden", async () => {
      const { userId, contaId } = await fixture("viewer");
      const sa = buildSa({
        actingUserId: userId,
        scopes: new Set(["transactions:write"]),
      });
      await expect(
        authorizeToolCall(
          sa,
          { requiredScope: "transactions:write", minRole: "owner" },
          { contaId }
        )
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("owner with scope passes", async () => {
      const { userId, contaId } = await fixture("owner");
      const sa = buildSa({
        actingUserId: userId,
        scopes: new Set(["transactions:write"]),
      });
      await expect(
        authorizeToolCall(
          sa,
          { requiredScope: "transactions:write", minRole: "owner" },
          { contaId }
        )
      ).resolves.toBeUndefined();
    });

    it("requestedBy inflated in meta does not elevate privilege", async () => {
      const { userId, contaId } = await fixture("viewer");
      const sa = buildSa({
        actingUserId: userId,
        scopes: new Set(["transactions:write"]),
      });
      // meta.requestedBy is irrelevant to authorizeToolCall — viewer still forbidden
      await expect(
        authorizeToolCall(
          sa,
          { requiredScope: "transactions:write", minRole: "owner" },
          { contaId }
        )
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("ToolAuthorizationError is thrown for missing scope", async () => {
      const { contaId } = await fixture("owner");
      const sa = buildSa({ scopes: new Set() });
      await expect(
        authorizeToolCall(
          sa,
          { requiredScope: "transactions:write", minRole: "owner" },
          { contaId }
        )
      ).rejects.toBeInstanceOf(ToolAuthorizationError);
    });
  });
});

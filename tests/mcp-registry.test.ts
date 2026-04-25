import { describe, it, expect } from "vitest";
import { buildToolRegistry } from "../src/mcp/tools/index.js";
import { dailyLimitGet, dailyLimitSet } from "../src/mcp/tools/daily-limit.js";
import type { ServiceAccount } from "../src/mcp/identity.js";
import { withAnnotations } from "../src/mcp/tools/__shared__/annotations.js";
import type { McpToolAny } from "../src/mcp/tool-types.js";

function makeSa(scopes: string[]): ServiceAccount {
  return Object.freeze({
    subject: "sa",
    scopes: new Set(scopes) as ReadonlySet<string>,
    actingUserId: "00000000-0000-0000-0000-000000000001",
    tokenExp: 9_999_999_999,
  });
}

describe("tool registry", () => {
  it("always exposes mcp.whoami, even with empty scopes", () => {
    const sa = makeSa([]);
    const reg = buildToolRegistry(sa);
    const visible = reg.listVisible(sa.scopes);
    const names = visible.map((t) => t.name);
    expect(names).toContain("mcp_whoami");
  });

  it("with only accounts:read, lists only accounts.list, accounts.get and whoami", () => {
    const sa = makeSa(["accounts:read"]);
    const reg = buildToolRegistry(sa);
    const names = reg.listVisible(sa.scopes).map((t) => t.name).sort();
    expect(names).toContain("accounts_list");
    expect(names).toContain("accounts_get");
    expect(names).toContain("mcp_whoami");
    // No writes visible
    expect(names).not.toContain("accounts_create");
    expect(names).not.toContain("transactions_create");
  });

  it("with transactions:read only, shows read tools but hides writes", () => {
    const sa = makeSa(["transactions:read"]);
    const reg = buildToolRegistry(sa);
    const names = reg.listVisible(sa.scopes).map((t) => t.name);
    expect(names).toContain("transactions_list");
    expect(names).not.toContain("transactions_create");
    expect(names).not.toContain("transactions_update");
    expect(names).not.toContain("transactions_delete");
  });

  it("exposes all expected tools when all scopes granted", () => {
    const sa = makeSa([
      "accounts:read",
      "accounts:write",
      "account-members:read",
      "categories:read",
      "categories:write",
      "transactions:read",
      "transactions:write",
      "transactions:delete",
      "debts:read",
      "debts:write",
      "goals:read",
      "goals:write",
      "daily-limit:read",
      "daily-limit:write",
      "projections:read",
    ]);
    const reg = buildToolRegistry(sa);
    const names = reg.listVisible(sa.scopes).map((t) => t.name);
    const expected = [
      "accounts_list",
      "accounts_get",
      "accounts_create",
      "account-members_list",
      "categories_list",
      "categories_create",
      "transactions_list",
      "transactions_create",
      "transactions_update",
      "transactions_delete",
      "debts_list",
      "debts_create",
      "debts_pay-installment",
      "goals_list",
      "goals_create",
      "goals_update",
      "daily-limit_get",
      "daily-limit_set",
      "projections_get",
      "mcp_whoami",
    ];
    for (const e of expected) {
      expect(names).toContain(e);
    }
  });

  describe("deprecation markers", () => {
    it("daily-limit_get description starts with [DEPRECATED", () => {
      expect(dailyLimitGet.description.startsWith("[DEPRECATED")).toBe(true);
    });

    it("daily-limit_set description starts with [DEPRECATED", () => {
      expect(dailyLimitSet.description.startsWith("[DEPRECATED")).toBe(true);
    });

    it("deprecated tools remain functional in registry", () => {
      const sa = makeSa(["daily-limit:read", "daily-limit:write"]);
      const reg = buildToolRegistry(sa);
      const names = reg.listVisible(sa.scopes).map((t) => t.name);
      expect(names).toContain("daily-limit_get");
      expect(names).toContain("daily-limit_set");
    });
  });

  describe("tool annotations", () => {
    it("every tool has a title annotation", () => {
      const sa = makeSa([
        "accounts:read", "accounts:write",
        "account-members:read", "account-members:write",
        "categories:read", "categories:write",
        "transactions:read", "transactions:write", "transactions:delete",
        "debts:read", "debts:write",
        "goals:read", "goals:write",
        "daily-limit:read", "daily-limit:write",
        "projections:read",
      ]);
      const reg = buildToolRegistry(sa);
      for (const tool of reg.all()) {
        expect(tool.annotations?.title).toBeTruthy();
      }
    });

    it("read-only tools have readOnlyHint: true", () => {
      const result = withAnnotations({
        name: "test_list",
        description: "test",
        inputSchema: { parse: (x: unknown) => x } as McpToolAny["inputSchema"],
        handler: async () => null,
      } as McpToolAny);
      expect(result.annotations.readOnlyHint).toBe(true);
      expect(result.annotations.destructiveHint).toBeUndefined();
    });

    it("write tools have destructiveHint: true", () => {
      const result = withAnnotations({
        name: "test_create",
        description: "test",
        inputSchema: { parse: (x: unknown) => x } as McpToolAny["inputSchema"],
        handler: async () => null,
      } as McpToolAny);
      expect(result.annotations.destructiveHint).toBe(true);
      expect(result.annotations.readOnlyHint).toBeUndefined();
    });

    it("mcp_whoami gets readOnlyHint", () => {
      const result = withAnnotations({
        name: "mcp_whoami",
        description: "test",
        inputSchema: { parse: (x: unknown) => x } as McpToolAny["inputSchema"],
        handler: async () => null,
      } as McpToolAny);
      expect(result.annotations.readOnlyHint).toBe(true);
      expect(result.annotations.title).toBe("Introspect Identity");
    });

    it("title is humanized from domain and action", () => {
      const result = withAnnotations({
        name: "account-members_add",
        description: "test",
        inputSchema: { parse: (x: unknown) => x } as McpToolAny["inputSchema"],
        handler: async () => null,
      } as McpToolAny);
      expect(result.annotations.title).toBe("Add Account Members");
    });

    const readOnlyNames = [
      "accounts_list", "accounts_get", "account-members_list",
      "categories_list", "transactions_list", "debts_list",
      "goals_list", "daily-limit_get", "daily-limit_v2_get",
      "projections_get",
    ];
    for (const name of readOnlyNames) {
      it(`${name} has readOnlyHint`, () => {
        const result = withAnnotations({
          name,
          description: "test",
          inputSchema: { parse: (x: unknown) => x } as McpToolAny["inputSchema"],
          handler: async () => null,
        } as McpToolAny);
        expect(result.annotations.readOnlyHint).toBe(true);
      });
    }

    const destructiveNames = [
      "accounts_create", "account-members_add", "categories_create",
      "transactions_create", "transactions_update", "transactions_delete",
      "debts_create", "debts_pay-installment", "goals_create", "goals_update",
      "daily-limit_set",
    ];
    for (const name of destructiveNames) {
      it(`${name} has destructiveHint`, () => {
        const result = withAnnotations({
          name,
          description: "test",
          inputSchema: { parse: (x: unknown) => x } as McpToolAny["inputSchema"],
          handler: async () => null,
        } as McpToolAny);
        expect(result.annotations.destructiveHint).toBe(true);
      });
    }
  });
});

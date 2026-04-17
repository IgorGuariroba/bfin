import { describe, it, expect } from "vitest";
import { buildToolRegistry } from "../src/mcp/tools/index.js";
import type { ServiceAccount } from "../src/mcp/identity.js";

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
    expect(names).toContain("mcp.whoami");
  });

  it("with only accounts:read, lists only accounts.list, accounts.get and whoami", () => {
    const sa = makeSa(["accounts:read"]);
    const reg = buildToolRegistry(sa);
    const names = reg.listVisible(sa.scopes).map((t) => t.name).sort();
    expect(names).toContain("accounts.list");
    expect(names).toContain("accounts.get");
    expect(names).toContain("mcp.whoami");
    // No writes visible
    expect(names).not.toContain("accounts.create");
    expect(names).not.toContain("transactions.create");
  });

  it("with transactions:read only, shows read tools but hides writes", () => {
    const sa = makeSa(["transactions:read"]);
    const reg = buildToolRegistry(sa);
    const names = reg.listVisible(sa.scopes).map((t) => t.name);
    expect(names).toContain("transactions.list");
    expect(names).not.toContain("transactions.create");
    expect(names).not.toContain("transactions.update");
    expect(names).not.toContain("transactions.delete");
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
      "accounts.list",
      "accounts.get",
      "accounts.create",
      "account-members.list",
      "categories.list",
      "categories.create",
      "transactions.list",
      "transactions.create",
      "transactions.update",
      "transactions.delete",
      "debts.list",
      "debts.create",
      "debts.pay-installment",
      "goals.list",
      "goals.create",
      "goals.update",
      "daily-limit.get",
      "daily-limit.set",
      "projections.get",
      "mcp.whoami",
    ];
    for (const e of expected) {
      expect(names).toContain(e);
    }
  });
});

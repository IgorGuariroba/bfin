import { describe, it, expect } from "vitest";
import { pino } from "pino";
import { buildWhoami } from "../src/mcp/tools/whoami.js";
import type { ServiceAccount } from "../src/mcp/identity.js";

describe("mcp.whoami", () => {
  it("returns service account metadata even with empty scopes", async () => {
    const sa: ServiceAccount = Object.freeze({
      subject: "sa-subject",
      scopes: new Set<string>() as ReadonlySet<string>,
      actingUserId: "00000000-0000-0000-0000-000000000001",
      tokenExp: 9_999_999_999,
    });
    const tool = buildWhoami(sa);
    const result = await tool.handler({
      input: {},
      actingUserId: sa.actingUserId,
      logger: pino({ level: "silent" }),
    });
    expect(result).toEqual({
      serviceAccount: true,
      subject: "sa-subject",
      scopes: [],
      actingUserId: sa.actingUserId,
      tokenExp: 9_999_999_999,
    });
  });

  it("sorts scopes alphabetically", async () => {
    const sa: ServiceAccount = Object.freeze({
      subject: "sa-subject",
      scopes: new Set<string>(["transactions:write", "accounts:read"]) as ReadonlySet<string>,
      actingUserId: "00000000-0000-0000-0000-000000000002",
      tokenExp: 9_999_999_999,
    });
    const tool = buildWhoami(sa);
    const result = (await tool.handler({
      input: {},
      actingUserId: sa.actingUserId,
      logger: pino({ level: "silent" }),
    })) as { scopes: string[] };
    expect(result.scopes).toEqual(["accounts:read", "transactions:write"]);
  });
});

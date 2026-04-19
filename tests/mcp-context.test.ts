import { describe, it, expect } from "vitest";
import { pino } from "pino";
import { createInvocationLogger } from "../src/mcp/context.js";

function captureLogger() {
  const entries: Record<string, unknown>[] = [];
  const logger = pino(
    { level: "debug" },
    {
      write(chunk: Buffer) {
        try {
          entries.push(JSON.parse(chunk.toString()));
        } catch {
          entries.push({ raw: chunk.toString() });
        }
      },
    }
  );
  return { logger, entries };
}

describe("createInvocationLogger", () => {
  it("binds tool and acting_user_id", () => {
    const { logger, entries } = captureLogger();
    const inv = createInvocationLogger(logger, {
      tool: "test",
      actingUserId: "u-1",
    });
    inv.info("hello");
    expect(entries[0]).toMatchObject({ tool: "test", acting_user_id: "u-1" });
  });

  it("binds scope when provided", () => {
    const { logger, entries } = captureLogger();
    const inv = createInvocationLogger(logger, {
      tool: "test",
      scope: "transactions:read",
      actingUserId: "u-1",
    });
    inv.info("hello");
    expect(entries[0]).toMatchObject({ scope: "transactions:read" });
  });

  it("binds requested_by when provided", () => {
    const { logger, entries } = captureLogger();
    const inv = createInvocationLogger(logger, {
      tool: "test",
      actingUserId: "u-1",
      requestedBy: "alice@example.com",
    });
    inv.info("hello");
    expect(entries[0]).toMatchObject({ requested_by: "alice@example.com" });
  });

  it("does not bind scope or requested_by when omitted", () => {
    const { logger, entries } = captureLogger();
    const inv = createInvocationLogger(logger, {
      tool: "test",
      actingUserId: "u-1",
    });
    inv.info("hello");
    expect(entries[0]).not.toHaveProperty("scope");
    expect(entries[0]).not.toHaveProperty("requested_by");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { InMemorySessionStore } from "../src/mcp/session-store.js";
import type { McpSession } from "../src/mcp/session-store.js";

function stubSession(overrides?: Partial<McpSession>): McpSession {
  return {
    sessionId: "s-1",
    transport: {} as McpSession["transport"],
    server: {} as McpSession["server"],
    sa: {
      subject: "user-1",
      scopes: new Set(),
      actingUserId: "00000000-0000-0000-0000-000000000000",
      tokenExp: undefined,
    },
    createdAt: 1000,
    lastActivity: 1000,
    ...overrides,
  };
}

describe("InMemorySessionStore", () => {
  let store: InMemorySessionStore;

  beforeEach(() => {
    store = new InMemorySessionStore({ ttlMs: 5000 });
  });

  it("puts and gets a session", async () => {
    const session = stubSession();
    await store.put(session);
    const got = await store.get("s-1");
    expect(got).toBe(session);
  });

  it("returns undefined for unknown session", async () => {
    const got = await store.get("nope");
    expect(got).toBeUndefined();
  });

  it("deletes a session", async () => {
    await store.put(stubSession());
    await store.delete("s-1");
    expect(await store.get("s-1")).toBeUndefined();
  });

  it("touch updates lastActivity", async () => {
    const session = stubSession();
    await store.put(session);
    const before = session.lastActivity;

    vi.spyOn(Date, "now").mockReturnValue(9999);
    await store.touch("s-1");
    vi.restoreAllMocks();

    expect(session.lastActivity).toBe(9999);
    expect(session.lastActivity).not.toBe(before);
  });

  it("touch is a no-op for non-existent session", async () => {
    await expect(store.touch("nope")).resolves.toBeUndefined();
  });

  it("reports correct size", async () => {
    expect(store.size()).toBe(0);
    await store.put(stubSession({ sessionId: "a" }));
    await store.put(stubSession({ sessionId: "b" }));
    expect(store.size()).toBe(2);
  });

  it("all() iterates over all sessions", async () => {
    const s1 = stubSession({ sessionId: "a" });
    const s2 = stubSession({ sessionId: "b" });
    await store.put(s1);
    await store.put(s2);
    expect([...store.all()]).toHaveLength(2);
  });

  it("cleanupExpired removes expired sessions", async () => {
    await store.put(stubSession({ sessionId: "old", lastActivity: 1000 }));
    await store.put(stubSession({ sessionId: "fresh", lastActivity: 6000 }));

    const removed = await store.cleanupExpired(7000);
    expect(removed).toEqual(["old"]);
    expect(store.size()).toBe(1);
    expect(await store.get("fresh")).toBeDefined();
  });

  it("cleanupExpired returns empty when nothing expired", async () => {
    await store.put(stubSession({ lastActivity: 6000 }));
    const removed = await store.cleanupExpired(7000);
    expect(removed).toEqual([]);
  });
});

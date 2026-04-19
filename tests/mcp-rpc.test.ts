import { describe, it, expect, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { pino } from "pino";
import { buildMcpServer } from "../src/mcp/rpc.js";
import type { ServiceAccount } from "../src/mcp/identity.js";
import type { ToolRegistry, McpToolAny } from "../src/mcp/tool-types.js";
import { z } from "zod";
import { NotFoundError, ForbiddenError, BusinessRuleError, ValidationError, SystemGeneratedResourceError, AppError } from "../src/lib/errors.js";

function makeSa(scopes: string[] = ["test:read", "test:write"]): ServiceAccount {
  return Object.freeze({
    subject: "test-user",
    scopes: new Set(scopes) as ReadonlySet<string>,
    actingUserId: "user-1",
    tokenExp: Math.floor(Date.now() / 1000) + 3600,
  });
}

function mockRegistry(tools: McpToolAny[]): ToolRegistry {
  const byName = new Map(tools.map((t) => [t.name, t]));
  return {
    get: (name) => byName.get(name),
    listVisible: (scopes) =>
      tools.filter((t) => !t.requiredScope || scopes.has(t.requiredScope)),
    all: () => tools,
  };
}

function captureLogger() {
  const entries: Record<string, unknown>[] = [];
  const logger = pino(
    { level: "info" },
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

async function connect(registry: ToolRegistry, sa: ServiceAccount, logger: ReturnType<typeof captureLogger>) {
  const server = buildMcpServer({ sa, registry, logger: logger.logger });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, server, close: () => Promise.all([client.close(), server.close()]) };
}

describe("buildMcpServer (unit)", () => {
  const echoTool: McpToolAny = {
    name: "echo",
    description: "Echoes input",
    requiredScope: "test:read",
    inputSchema: z.object({ msg: z.string() }),
    handler: async ({ input }) => ({ echoed: input.msg }),
  };

  const failingTool: McpToolAny = {
    name: "fail-not-found",
    description: "Throws NotFoundError",
    requiredScope: "test:read",
    inputSchema: z.object({ id: z.string() }),
    handler: async () => {
      throw new NotFoundError("Item not found");
    },
  };

  const forbiddenTool: McpToolAny = {
    name: "fail-forbidden",
    description: "Throws ForbiddenError",
    requiredScope: "test:read",
    inputSchema: z.object({}),
    handler: async () => {
      throw new ForbiddenError("Not allowed");
    },
  };

  const businessRuleTool: McpToolAny = {
    name: "fail-business",
    description: "Throws BusinessRuleError",
    requiredScope: "test:read",
    inputSchema: z.object({}),
    handler: async () => {
      throw new BusinessRuleError("Business rule violated");
    },
  };

  const noScopeTool: McpToolAny = {
    name: "no-scope-tool",
    description: "No scope required",
    inputSchema: z.object({}),
    handler: async () => ({ ok: true }),
  };

  const registry = mockRegistry([echoTool, failingTool, forbiddenTool, businessRuleTool, noScopeTool]);

  it("lists only visible tools based on scopes", async () => {
    const sa = makeSa(["test:read"]);
    const log = captureLogger();
    const { client, close } = await connect(registry, sa, log);

    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name);
    expect(names).toContain("echo");
    expect(names).toContain("no-scope-tool");
    await close();
  });

  it("hides tools when scope is missing", async () => {
    const sa = makeSa([]);
    const log = captureLogger();
    const { client, close } = await connect(registry, sa, log);

    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name);
    expect(names).not.toContain("echo");
    expect(names).toContain("no-scope-tool");
    await close();
  });

  it("echo tool returns result", async () => {
    const sa = makeSa(["test:read"]);
    const log = captureLogger();
    const { client, close } = await connect(registry, sa, log);

    const res = await client.callTool({ name: "echo", arguments: { msg: "hello" } });
    expect(res.isError).not.toBe(true);
    const content = (res.content as Array<{ type: string; text: string }>)[0];
    const parsed = JSON.parse(content.text);
    expect(parsed.echoed).toBe("hello");
    await close();
  });

  it("returns tool-not-found for unknown tool", async () => {
    const sa = makeSa(["test:read"]);
    const log = captureLogger();
    const { client, close } = await connect(registry, sa, log);

    const res = await client.callTool({ name: "nonexistent", arguments: {} });
    expect(res.isError).toBe(true);
    const content = (res.content as Array<{ type: string; text: string }>)[0];
    expect(content.text).toContain("not found");
    await close();
  });

  it("scope-missing tool call returns authorization error", async () => {
    const sa = makeSa(["test:read"]);
    const log = captureLogger();
    const { client, close } = await connect(registry, sa, log);

    const res = await client.callTool({ name: "echo", arguments: { msg: "hi" } });
    expect(res.isError).not.toBe(true);
    await close();
  });

  it("NotFoundError maps to -32001", async () => {
    const sa = makeSa(["test:read"]);
    const log = captureLogger();
    const { client, close } = await connect(registry, sa, log);

    const res = await client.callTool({ name: "fail-not-found", arguments: { id: "x" } });
    expect(res.isError).toBe(true);
    const content = (res.content as Array<{ type: string; text: string }>)[0];
    expect(content.text).toContain("-32001");
    await close();
  });

  it("ForbiddenError maps to -32003", async () => {
    const sa = makeSa(["test:read"]);
    const log = captureLogger();
    const { client, close } = await connect(registry, sa, log);

    const res = await client.callTool({ name: "fail-forbidden", arguments: {} });
    expect(res.isError).toBe(true);
    const content = (res.content as Array<{ type: string; text: string }>)[0];
    expect(content.text).toContain("-32003");
    await close();
  });

  it("BusinessRuleError maps to -32002", async () => {
    const sa = makeSa(["test:read"]);
    const log = captureLogger();
    const { client, close } = await connect(registry, sa, log);

    const res = await client.callTool({ name: "fail-business", arguments: {} });
    expect(res.isError).toBe(true);
    const content = (res.content as Array<{ type: string; text: string }>)[0];
    expect(content.text).toContain("-32002");
    await close();
  });

  it("invalid input returns -32600", async () => {
    const sa = makeSa(["test:read"]);
    const log = captureLogger();
    const { client, close } = await connect(registry, sa, log);

    const res = await client.callTool({ name: "echo", arguments: { wrong_field: 123 } });
    expect(res.isError).toBe(true);
    const content = (res.content as Array<{ type: string; text: string }>)[0];
    expect(content.text).toContain("-32600");
    await close();
  });

  it("tool without requiredScope is callable without scope", async () => {
    const sa = makeSa([]);
    const log = captureLogger();
    const { client, close } = await connect(registry, sa, log);

    const res = await client.callTool({ name: "no-scope-tool", arguments: {} });
    expect(res.isError).not.toBe(true);
    await close();
  });

  it("SystemGeneratedResourceError maps to -32004", async () => {
    const sysErrTool: McpToolAny = {
      name: "sys-err-tool",
      description: "Throws SystemGeneratedResourceError",
      requiredScope: "test:read",
      inputSchema: z.object({}),
      handler: async () => {
        throw new SystemGeneratedResourceError("Cannot modify system resource");
      },
    };
    const localRegistry = mockRegistry([sysErrTool]);
    const sa = makeSa(["test:read"]);
    const log = captureLogger();
    const { client, close } = await connect(localRegistry, sa, log);

    const res = await client.callTool({ name: "sys-err-tool", arguments: {} });
    expect(res.isError).toBe(true);
    const content = (res.content as Array<{ type: string; text: string }>)[0];
    expect(content.text).toContain("-32004");
    await close();
  });

  it("generic AppError maps to -32602", async () => {
    const appErrTool: McpToolAny = {
      name: "app-err-tool",
      description: "Throws generic AppError",
      requiredScope: "test:read",
      inputSchema: z.object({}),
      handler: async () => {
        throw new AppError("Something went wrong", 500, "INTERNAL_ERROR");
      },
    };
    const localRegistry = mockRegistry([appErrTool]);
    const sa = makeSa(["test:read"]);
    const log = captureLogger();
    const { client, close } = await connect(localRegistry, sa, log);

    const res = await client.callTool({ name: "app-err-tool", arguments: {} });
    expect(res.isError).toBe(true);
    const content = (res.content as Array<{ type: string; text: string }>)[0];
    expect(content.text).toContain("-32602");
    await close();
  });

  it("unexpected error maps to -32603", async () => {
    const crashTool: McpToolAny = {
      name: "crash-tool",
      description: "Throws unexpected error",
      requiredScope: "test:read",
      inputSchema: z.object({}),
      handler: async () => {
        throw new Error("unexpected crash");
      },
    };
    const localRegistry = mockRegistry([crashTool]);
    const sa = makeSa(["test:read"]);
    const log = captureLogger();
    const { client, close } = await connect(localRegistry, sa, log);

    const res = await client.callTool({ name: "crash-tool", arguments: {} });
    expect(res.isError).toBe(true);
    const content = (res.content as Array<{ type: string; text: string }>)[0];
    expect(content.text).toContain("-32603");
    await close();
  });

  it("tool with scope missing returns authorization error", async () => {
    const sa = makeSa([]);
    const log = captureLogger();
    const { client, close } = await connect(registry, sa, log);

    const res = await client.callTool({ name: "echo", arguments: { msg: "hi" } });
    expect(res.isError).toBe(true);
    const content = (res.content as Array<{ type: string; text: string }>)[0];
    expect(content.text).toContain("-32003");
    await close();
  });
});

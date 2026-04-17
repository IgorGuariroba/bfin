import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { pino } from "pino";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import { buildMcpServer } from "../src/mcp/rpc.js";
import { buildToolRegistry } from "../src/mcp/tools/index.js";
import type { ServiceAccount } from "../src/mcp/identity.js";

interface Fixture {
  userId: string;
  contaId: string;
  categoriaReceita: string;
}

function makeSa(userId: string, scopes: string[]): ServiceAccount {
  return Object.freeze({
    subject: "sa-test",
    scopes: new Set(scopes) as ReadonlySet<string>,
    actingUserId: userId,
    tokenExp: Math.floor(Date.now() / 1000) + 3600,
  });
}

async function createClientServer(
  testApp: TestApp,
  sa: ServiceAccount,
  captureLogs: { entries: Record<string, unknown>[] }
) {
  const testLogger = pino(
    { level: "info" },
    {
      write(chunk) {
        try {
          captureLogs.entries.push(JSON.parse(chunk.toString()));
        } catch {
          captureLogs.entries.push({ raw: chunk.toString() });
        }
      },
    }
  );
  const registry = buildToolRegistry(sa);
  const server = buildMcpServer({ sa, registry, logger: testLogger });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "bfin-test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return {
    client,
    async close() {
      await client.close();
      await server.close();
      await testApp.teardown();
    },
  };
}

async function buildFixtures(testApp: TestApp): Promise<Fixture> {
  const [u] = await testApp.client`
    INSERT INTO usuarios (id_provedor, nome, email)
    VALUES ('sa-user', 'SA User', 'sa@example.com')
    RETURNING id
  `;
  const [c] = await testApp.client`
    INSERT INTO contas (nome, saldo_inicial)
    VALUES ('Conta MCP', 1000)
    RETURNING id
  `;
  await testApp.client`
    INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
    VALUES (${c.id}, ${u.id}, 'owner')
  `;
  // Ensure tipo_categorias has 'receita'
  await testApp.client`
    INSERT INTO tipo_categorias (slug, nome)
    VALUES ('receita', 'Receita')
    ON CONFLICT (slug) DO NOTHING
  `;
  const [tipo] = await testApp.client`
    SELECT id FROM tipo_categorias WHERE slug = 'receita'
  `;
  const [cat] = await testApp.client`
    INSERT INTO categorias (nome, tipo_categoria_id)
    VALUES ('Salário', ${tipo.id})
    RETURNING id
  `;
  return {
    userId: u.id as string,
    contaId: c.id as string,
    categoriaReceita: cat.id as string,
  };
}

describe("MCP integration (in-memory transport)", () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp({});
    await testApp.truncateAll();
  });

  afterEach(async () => {
    await testApp?.teardown().catch(() => {});
  });

  it("handshake + tools/list + tools/call transactions.create + transactions.list", async () => {
    const fx = await buildFixtures(testApp);
    const sa = makeSa(fx.userId, ["transactions:read", "transactions:write"]);
    const logs = { entries: [] as Record<string, unknown>[] };
    const { client, close } = await createClientServer(testApp, sa, logs);

    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name).sort();
    expect(names).toContain("transactions.create");
    expect(names).toContain("transactions.list");
    expect(names).toContain("mcp.whoami");

    const createRes = await client.callTool({
      name: "transactions.create",
      arguments: {
        contaId: fx.contaId,
        tipo: "receita",
        categoriaId: fx.categoriaReceita,
        descricao: "Salário",
        valor: 5000,
        data: new Date("2026-04-01T12:00:00Z").toISOString(),
      },
    });
    expect(createRes.isError).not.toBe(true);
    const txnRows = await testApp.client`SELECT id FROM movimentacoes`;
    expect(txnRows.length).toBe(1);

    const listRes = await client.callTool({
      name: "transactions.list",
      arguments: { contaId: fx.contaId },
    });
    const content = (listRes.content as Array<{ type: string; text: string }>)[0];
    const parsed = JSON.parse(content.text);
    expect(parsed.pagination.total).toBe(1);

    await close();
  });

  it("transactions.create without transactions:write returns scope error and creates no record", async () => {
    const fx = await buildFixtures(testApp);
    const sa = makeSa(fx.userId, ["transactions:read"]);
    const logs = { entries: [] as Record<string, unknown>[] };
    const { client, close } = await createClientServer(testApp, sa, logs);

    const res = await client.callTool({
      name: "transactions.create",
      arguments: {
        contaId: fx.contaId,
        tipo: "receita",
        categoriaId: fx.categoriaReceita,
        valor: 100,
        data: new Date("2026-04-01T12:00:00Z").toISOString(),
      },
    });
    expect(res.isError).toBe(true);
    const txnRows = await testApp.client`SELECT id FROM movimentacoes`;
    expect(txnRows.length).toBe(0);
    await close();
  });

  it("meta.requestedBy is logged but does not grant privilege", async () => {
    const fx = await buildFixtures(testApp);
    const sa = makeSa(fx.userId, ["transactions:read"]);
    const logs = { entries: [] as Record<string, unknown>[] };
    const { client, close } = await createClientServer(testApp, sa, logs);

    // Call without write scope, but with meta.requestedBy: still forbidden
    const res = await client.callTool({
      name: "transactions.create",
      arguments: {
        contaId: fx.contaId,
        tipo: "receita",
        categoriaId: fx.categoriaReceita,
        valor: 10,
        data: new Date("2026-04-01T12:00:00Z").toISOString(),
      },
      _meta: { requestedBy: "alguem@exemplo.com" },
    });
    expect(res.isError).toBe(true);

    const loggedRequestedBy = logs.entries.find(
      (e) => e.requested_by === "alguem@exemplo.com"
    );
    expect(loggedRequestedBy).toBeDefined();
    await close();
  });
});

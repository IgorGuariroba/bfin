import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { pino } from "pino";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import type { buildMcpServer as BuildMcpServerType } from "../src/mcp/rpc.js";
import type { buildToolRegistry as BuildToolRegistryType } from "../src/mcp/tools/index.js";
import type { ServiceAccount } from "../src/mcp/identity.js";

interface Fixture {
  userId: string;
  contaId: string;
  categoriaReceita: string;
  categoriaDespesa: string;
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
) {
  const testLogger = pino({ level: "silent" });
  const { buildToolRegistry } = await import("../src/mcp/tools/index.js");
  const { buildMcpServer } = await import("../src/mcp/rpc.js");
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
  await testApp.client`
    INSERT INTO tipo_categorias (slug, nome)
    VALUES ('receita', 'Receita'), ('despesa', 'Despesa')
    ON CONFLICT (slug) DO NOTHING
  `;
  const [tipoReceita] = await testApp.client`SELECT id FROM tipo_categorias WHERE slug = 'receita'`;
  const [tipoDespesa] = await testApp.client`SELECT id FROM tipo_categorias WHERE slug = 'despesa'`;
  const [catReceita] = await testApp.client`
    INSERT INTO categorias (nome, tipo_categoria_id) VALUES ('Salario', ${tipoReceita.id}) RETURNING id
  `;
  const [catDespesa] = await testApp.client`
    INSERT INTO categorias (nome, tipo_categoria_id) VALUES ('Aluguel', ${tipoDespesa.id}) RETURNING id
  `;
  return {
    userId: u.id as string,
    contaId: c.id as string,
    categoriaReceita: catReceita.id as string,
    categoriaDespesa: catDespesa.id as string,
  };
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
) {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
  return { res, parsed: text ? JSON.parse(text) : null };
}

describe("MCP mass assignment protection", () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp({});
    await testApp.truncateAll();
  });

  afterEach(async () => {
    await testApp?.teardown().catch(() => {});
  });

  describe("transactions_update", () => {
    it("ignores protected fields (createdAt, usuarioId, parcelaDividaId)", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["transactions:read", "transactions:write"]);
      const { client, close } = await createClientServer(testApp, sa);

      // Create a transaction
      const { parsed: created } = await callTool(client, "transactions_create", {
        contaId: fx.contaId,
        tipo: "receita",
        categoriaId: fx.categoriaReceita,
        descricao: "Salario",
        valor: 5000,
        data: new Date("2026-04-01T12:00:00Z").toISOString(),
      });
      const txId = created.id;

      // Get original values
      const [original] = await testApp.client`
        SELECT created_at, usuario_id, parcela_divida_id FROM movimentacoes WHERE id = ${txId}
      `;
      const originalCreatedAt = original.created_at;
      const originalUsuarioId = original.usuario_id;
      const originalParcelaDividaId = original.parcela_divida_id;

      // Attempt mass assignment with protected fields
      const { parsed: updated } = await callTool(client, "transactions_update", {
        id: txId,
        contaId: fx.contaId,
        valor: 9999,
        createdAt: "2099-01-01T00:00:00Z",
        usuarioId: "00000000-0000-0000-0000-000000000000",
        parcelaDividaId: "00000000-0000-0000-0000-000000000000",
      });

      expect(updated.valor).toBe("9999.00");

      // Verify protected fields were not modified
      const [afterUpdate] = await testApp.client`
        SELECT created_at, usuario_id, parcela_divida_id FROM movimentacoes WHERE id = ${txId}
      `;
      expect(afterUpdate.created_at).toEqual(originalCreatedAt);
      expect(afterUpdate.usuario_id).toEqual(originalUsuarioId);
      expect(afterUpdate.parcela_divida_id).toEqual(originalParcelaDividaId);

      await close();
    });

    it("ignores unknown extra fields in update payload", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["transactions:read", "transactions:write"]);
      const { client, close } = await createClientServer(testApp, sa);

      const { parsed: created } = await callTool(client, "transactions_create", {
        contaId: fx.contaId,
        tipo: "receita",
        categoriaId: fx.categoriaReceita,
        descricao: "Salario",
        valor: 5000,
        data: new Date("2026-04-01T12:00:00Z").toISOString(),
      });
      const txId = created.id;

      const [original] = await testApp.client`
        SELECT descricao FROM movimentacoes WHERE id = ${txId}
      `;

      const { parsed: updated } = await callTool(client, "transactions_update", {
        id: txId,
        contaId: fx.contaId,
        descricao: "Novo",
        isAdmin: true,
        role: "superuser",
        metadata: { injected: "value" },
      });

      expect(updated.descricao).toBe("Novo");

      const [afterUpdate] = await testApp.client`
        SELECT descricao FROM movimentacoes WHERE id = ${txId}
      `;
      expect(afterUpdate.descricao).toBe("Novo");

      await close();
    });

    it("ignores nested objects with protected fields", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["transactions:read", "transactions:write"]);
      const { client, close } = await createClientServer(testApp, sa);

      const { parsed: created } = await callTool(client, "transactions_create", {
        contaId: fx.contaId,
        tipo: "receita",
        categoriaId: fx.categoriaReceita,
        descricao: "Original",
        valor: 100,
        data: new Date("2026-04-01T12:00:00Z").toISOString(),
      });
      const txId = created.id;

      const { parsed: updated } = await callTool(client, "transactions_update", {
        id: txId,
        contaId: fx.contaId,
        valor: 200,
        extra: {
          createdAt: "2099-01-01T00:00:00Z",
          usuarioId: "00000000-0000-0000-0000-000000000000",
        },
      });

      expect(updated.valor).toBe("200.00");

      await close();
    });
  });

  describe("goals_update", () => {
    it("ignores protected fields (id, createdAt, updatedAt)", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["goals:read", "goals:write"]);
      const { client, close } = await createClientServer(testApp, sa);

      // Create goal first
      await callTool(client, "goals_create", {
        contaId: fx.contaId,
        porcentagemReserva: 10,
      });

      const [original] = await testApp.client`
        SELECT id, created_at, updated_at FROM meta WHERE conta_id = ${fx.contaId}
      `;
      const originalId = original.id;
      const originalCreatedAt = original.created_at;
      const originalUpdatedAt = original.updated_at;

      // Attempt mass assignment
      const { parsed: updated } = await callTool(client, "goals_update", {
        contaId: fx.contaId,
        porcentagemReserva: 25,
        id: "00000000-0000-0000-0000-000000000000",
        createdAt: "2099-01-01T00:00:00Z",
        updatedAt: "2099-01-01T00:00:00Z",
      });

      expect(updated.porcentagem_reserva).toBe("25.00");

      const [afterUpdate] = await testApp.client`
        SELECT id, created_at, updated_at FROM meta WHERE conta_id = ${fx.contaId}
      `;
      expect(afterUpdate.id).toEqual(originalId);
      expect(afterUpdate.created_at).toEqual(originalCreatedAt);
      // updated_at should have changed because the row was actually updated
      // but not to the injected value — it should be a recent timestamp
      expect(afterUpdate.updated_at).not.toEqual(new Date("2099-01-01T00:00:00Z"));

      await close();
    });

    it("ignores unknown extra fields", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["goals:read", "goals:write"]);
      const { client, close } = await createClientServer(testApp, sa);

      await callTool(client, "goals_create", {
        contaId: fx.contaId,
        porcentagemReserva: 10,
      });

      const { parsed: updated } = await callTool(client, "goals_update", {
        contaId: fx.contaId,
        porcentagemReserva: 30,
        isAdmin: true,
        role: "owner",
        secretField: "hacked",
      });

      expect(updated.porcentagem_reserva).toBe("30.00");

      await close();
    });
  });
});

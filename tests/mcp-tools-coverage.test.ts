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
  categoriaDivida: string;
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
    VALUES ('receita', 'Receita'), ('despesa', 'Despesa'), ('divida', 'Divida')
    ON CONFLICT (slug) DO NOTHING
  `;
  const [tipoReceita] = await testApp.client`SELECT id FROM tipo_categorias WHERE slug = 'receita'`;
  const [tipoDespesa] = await testApp.client`SELECT id FROM tipo_categorias WHERE slug = 'despesa'`;
  const [tipoDivida] = await testApp.client`SELECT id FROM tipo_categorias WHERE slug = 'divida'`;
  const [catReceita] = await testApp.client`
    INSERT INTO categorias (nome, tipo_categoria_id) VALUES ('Salario', ${tipoReceita.id}) RETURNING id
  `;
  const [catDespesa] = await testApp.client`
    INSERT INTO categorias (nome, tipo_categoria_id) VALUES ('Aluguel', ${tipoDespesa.id}) RETURNING id
  `;
  const [catDivida] = await testApp.client`
    INSERT INTO categorias (nome, tipo_categoria_id) VALUES ('Emprestimo', ${tipoDivida.id}) RETURNING id
  `;
  return {
    userId: u.id as string,
    contaId: c.id as string,
    categoriaReceita: catReceita.id as string,
    categoriaDespesa: catDespesa.id as string,
    categoriaDivida: catDivida.id as string,
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

describe("MCP tools coverage", () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp({});
    await testApp.truncateAll();
  });

  afterEach(async () => {
    await testApp?.teardown().catch(() => {});
  });

  describe("accounts", () => {
    it("accounts.list returns accounts for user", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["accounts:read"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "accounts_list", {});
      expect(Array.isArray(parsed.data)).toBe(true);
      expect(parsed.data.length).toBeGreaterThanOrEqual(1);
      await close();
    });

    it("accounts.get returns account by id", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["accounts:read"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "accounts_get", { contaId: fx.contaId });
      expect(parsed.id).toBe(fx.contaId);
      await close();
    });

    it("accounts.create creates a new account", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["accounts:write"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "accounts_create", { nome: "Nova Conta", saldoInicial: 500 });
      expect(parsed.nome).toBe("Nova Conta");
      await close();
    });
  });

  describe("account-members", () => {
    it("account-members.list returns members", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["account-members:read"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "account-members_list", { contaId: fx.contaId });
      expect(Array.isArray(parsed.data)).toBe(true);
      expect(parsed.data.length).toBe(1);
      await close();
    });

    it("account-members.add adds existing user by email", async () => {
      const fx = await buildFixtures(testApp);
      const [u2] = await testApp.client`
        INSERT INTO usuarios (id_provedor, nome, email)
        VALUES ('other-user', 'Other User', 'other@example.com')
        RETURNING id
      `;
      const sa = makeSa(fx.userId, ["account-members:write"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "account-members_add", {
        contaId: fx.contaId,
        email: "other@example.com",
        papel: "viewer",
      });
      expect(parsed.email).toBe("other@example.com");
      expect(parsed.papel).toBe("viewer");
      expect(parsed.usuarioId).toBe(u2.id);
      await close();
    });

    it("account-members.add blocks viewer from adding members", async () => {
      const fx = await buildFixtures(testApp);
      const [u2] = await testApp.client`
        INSERT INTO usuarios (id_provedor, nome, email)
        VALUES ('viewer-user', 'Viewer User', 'viewer@example.com')
        RETURNING id
      `;
      await testApp.client`
        INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
        VALUES (${fx.contaId}, ${u2.id}, 'viewer')
      `;
      const sa = makeSa(u2.id as string, ["account-members:write"]);
      const { client, close } = await createClientServer(testApp, sa);
      const res = await client.callTool({
        name: "account-members_add",
        arguments: {
          contaId: fx.contaId,
          email: "someone@example.com",
          papel: "viewer",
        },
      });
      expect(res.isError).toBe(true);
      const text = (res.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
      expect(text).toContain("[-32003]");
      await close();
    });

    it("account-members.add returns 404 for non-existent email", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["account-members:write"]);
      const { client, close } = await createClientServer(testApp, sa);
      const res = await client.callTool({
        name: "account-members_add",
        arguments: {
          contaId: fx.contaId,
          email: "nobody@example.com",
          papel: "viewer",
        },
      });
      expect(res.isError).toBe(true);
      const text = (res.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
      expect(text).toContain("[-32001]");
      await close();
    });
  });

  describe("goals", () => {
    it("goals.list returns null when unset", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["goals:read"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "goals_list", { contaId: fx.contaId });
      expect(parsed.contaId).toBe(fx.contaId);
      expect(parsed.meta).toBeNull();
      await close();
    });

    it("goals.create sets reserve goal", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["goals:write"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "goals_create", { contaId: fx.contaId, porcentagemReserva: 15 });
      expect(parsed.porcentagem_reserva).toBe("15.00");
      await close();
    });

  });

  describe("categories", () => {
    it("categories.list returns categories", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["categories:read"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "categories_list", {});
      expect(Array.isArray(parsed.data)).toBe(true);
      await close();
    });

    it("categories.create creates a category", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["categories:write"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "categories_create", { contaId: fx.contaId, nome: "Nova Categoria", tipo: "receita" });
      expect(parsed.nome).toBe("Nova Categoria");
      await close();
    });
  });

  describe("daily-limit", () => {
    it("daily-limit.get computes limit", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["daily-limit:read"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "daily-limit_get", { contaId: fx.contaId });
      expect(typeof parsed.limite_diario).toBe("string");
      await close();
    });

    it("daily-limit.set configures reserve percentage", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["daily-limit:write"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "daily-limit_set", { contaId: fx.contaId, porcentagemReserva: 10 });
      expect(parsed.porcentagem_reserva).toBe("10.00");
      await close();
    });
  });

  describe("debts", () => {
    it("debts.list returns debts", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["debts:read"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "debts_list", { contaId: fx.contaId });
      expect(Array.isArray(parsed.data)).toBe(true);
      await close();
    });

    it("debts.create creates a debt", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["debts:write"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "debts_create", {
        contaId: fx.contaId,
        categoriaId: fx.categoriaDivida,
        descricao: "Novo Emprestimo",
        valorTotal: 5000,
        totalParcelas: 5,
        dataInicio: new Date("2026-04-01T12:00:00Z").toISOString(),
      });
      expect(parsed.descricao).toBe("Novo Emprestimo");
      await close();
    });
  });

  describe("projections", () => {
    it("projections.get returns projection data", async () => {
      const fx = await buildFixtures(testApp);
      const sa = makeSa(fx.userId, ["projections:read"]);
      const { client, close } = await createClientServer(testApp, sa);
      const { parsed } = await callTool(client, "projections_get", { contaId: fx.contaId, mes: "2026-04" });
      expect(parsed.contaId).toBe(fx.contaId);
      expect(parsed.mes).toBe("2026-04");
      await close();
    });
  });
});

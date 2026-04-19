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
  userA: { id: string };
  userB: { id: string };
  contaA: { id: string };
  contaB: { id: string };
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

async function createClientServer(sa: ServiceAccount) {
  const testLogger = pino({ level: "silent" });
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
  const [uA] = await testApp.client`
    INSERT INTO usuarios (id_provedor, nome, email)
    VALUES ('user-a', 'User A', 'a@example.com')
    RETURNING id
  `;
  const [uB] = await testApp.client`
    INSERT INTO usuarios (id_provedor, nome, email)
    VALUES ('user-b', 'User B', 'b@example.com')
    RETURNING id
  `;

  const [cA] = await testApp.client`
    INSERT INTO contas (nome, saldo_inicial) VALUES ('Conta A', 1000) RETURNING id
  `;
  const [cB] = await testApp.client`
    INSERT INTO contas (nome, saldo_inicial) VALUES ('Conta B', 2000) RETURNING id
  `;

  await testApp.client`
    INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
    VALUES (${cA.id}, ${uA.id}, 'owner')
  `;
  await testApp.client`
    INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
    VALUES (${cB.id}, ${uB.id}, 'owner')
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
    userA: uA,
    userB: uB,
    contaA: cA,
    contaB: cB,
    categoriaReceita: catReceita.id as string,
    categoriaDespesa: catDespesa.id as string,
    categoriaDivida: catDivida.id as string,
  };
}

const IDOR_ERROR_RE = /forbidden|Insufficient permissions|You do not have access/i;

function assertIdorError(res: { isError?: boolean; content: unknown }) {
  expect(res.isError).toBe(true);
  const text = (res.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
  expect(text).toMatch(IDOR_ERROR_RE);
}

describe("MCP IDOR protection", () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp({});
    await testApp.truncateAll();
  });

  afterEach(async () => {
    await testApp?.teardown().catch(() => {});
  });

  async function callAsUserA(fx: Fixture, scope: string, name: string, args: Record<string, unknown>) {
    const sa = makeSa(fx.userA.id, [scope]);
    const { client, close } = await createClientServer(sa);
    try {
      return await client.callTool({ name, arguments: args });
    } finally {
      await close();
    }
  }

  describe("transactions.update", () => {
    it("rejects updating a transaction from another account", async () => {
      const fx = await buildFixtures(testApp);

      const [txn] = await testApp.client`
        INSERT INTO movimentacoes (conta_id, usuario_id, categoria_id, descricao, valor, data, recorrente)
        VALUES (${fx.contaB.id}, ${fx.userB.id}, ${fx.categoriaReceita}, 'Salario B', '5000', '2026-04-01', false)
        RETURNING id
      `;

      const res = await callAsUserA(fx, "transactions:write", "transactions.update", {
        id: txn.id,
        contaId: fx.contaA.id,
        descricao: "Tentativa de IDOR",
      });
      assertIdorError(res);

      const [updated] = await testApp.client`
        SELECT descricao FROM movimentacoes WHERE id = ${txn.id}
      `;
      expect(updated.descricao).toBe("Salario B");
    });
  });

  describe("transactions.delete", () => {
    it("rejects deleting a transaction from another account", async () => {
      const fx = await buildFixtures(testApp);

      const [txn] = await testApp.client`
        INSERT INTO movimentacoes (conta_id, usuario_id, categoria_id, descricao, valor, data, recorrente)
        VALUES (${fx.contaB.id}, ${fx.userB.id}, ${fx.categoriaReceita}, 'Salario B', '5000', '2026-04-01', false)
        RETURNING id
      `;

      const res = await callAsUserA(fx, "transactions:write", "transactions.delete", {
        id: txn.id,
        contaId: fx.contaA.id,
      });
      assertIdorError(res);

      const [remaining] = await testApp.client`
        SELECT id FROM movimentacoes WHERE id = ${txn.id}
      `;
      expect(remaining).toBeDefined();
    });
  });

  describe("debts.pay-installment", () => {
    it("rejects paying an installment from another account", async () => {
      const fx = await buildFixtures(testApp);

      const [divida] = await testApp.client`
        INSERT INTO dividas (conta_id, usuario_id, categoria_id, descricao, valor_total, total_parcelas, valor_parcela, data_inicio)
        VALUES (${fx.contaB.id}, ${fx.userB.id}, ${fx.categoriaDivida}, 'Emprestimo B', '10000', 10, '1000', '2026-04-01')
        RETURNING id
      `;
      const [parcela] = await testApp.client`
        INSERT INTO parcelas_divida (divida_id, numero_parcela, valor, data_vencimento)
        VALUES (${divida.id}, 1, '1000', '2026-05-01')
        RETURNING id
      `;

      const res = await callAsUserA(fx, "debts:write", "debts.pay-installment", {
        dividaId: divida.id,
        parcelaId: parcela.id,
        contaId: fx.contaA.id,
        dataPagamento: new Date("2026-04-15T12:00:00Z").toISOString(),
      });
      assertIdorError(res);

      const [unpaid] = await testApp.client`
        SELECT data_pagamento FROM parcelas_divida WHERE id = ${parcela.id}
      `;
      expect(unpaid.data_pagamento).toBeNull();
    });
  });
});

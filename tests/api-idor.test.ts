import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";

describe("API HTTP IDOR protection", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  async function createUser(app: TestApp, idProvedor: string, email: string) {
    const [user] = await app.client`
      INSERT INTO usuarios (id_provedor, nome, email, is_admin)
      VALUES (${idProvedor}, ${email.split("@")[0]}, ${email}, false)
      RETURNING id
    `;
    return user.id as string;
  }

  async function seedTipoCategorias(app: TestApp) {
    await app.client`
      INSERT INTO tipo_categorias (slug, nome)
      VALUES ('receita', 'Receita'), ('despesa', 'Despesa'), ('divida', 'Dívida')
      ON CONFLICT (slug) DO NOTHING
    `;
  }

  async function createCategory(app: TestApp, nome: string, tipo: string) {
    const [row] = await app.client`
      INSERT INTO categorias (nome, tipo_categoria_id)
      SELECT ${nome}, id FROM tipo_categorias WHERE slug = ${tipo}
      RETURNING id
    `;
    return row.id as string;
  }

  async function createAccount(app: TestApp, usuarioId: string, nome: string) {
    const [conta] = await app.client`
      INSERT INTO contas (nome, saldo_inicial) VALUES (${nome}, 0) RETURNING id
    `;
    await app.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${conta.id}, ${usuarioId}, 'owner')
    `;
    return conta.id as string;
  }

  async function makeToken(keyPair: Awaited<ReturnType<typeof generateTestKeyPair>>, idProvedor: string, email: string) {
    return signTestToken(keyPair, { sub: idProvedor, email, name: idProvedor });
  }

  describe("Transactions", () => {
    it("rejects updating a transaction from another account", async () => {
      const keyPair = await generateTestKeyPair();
      testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
      await testApp.truncateAll();
      await seedTipoCategorias(testApp);

      const userA = await createUser(testApp, "u-a", "a@example.com");
      const userB = await createUser(testApp, "u-b", "b@example.com");
      const contaA = await createAccount(testApp, userA, "Conta A");
      const contaB = await createAccount(testApp, userB, "Conta B");
      const catId = await createCategory(testApp, "Alimentação", "despesa");

      const tokenB = await makeToken(keyPair, "u-b", "b@example.com");
      const createRes = await testApp.app.inject({
        method: "POST",
        url: "/movimentacoes",
        headers: { authorization: `Bearer ${tokenB}` },
        payload: {
          contaId: contaB,
          tipo: "despesa",
          categoriaId: catId,
          valor: 100,
          data: "2024-01-20",
        },
      });
      const txn = JSON.parse(createRes.payload);

      const tokenA = await makeToken(keyPair, "u-a", "a@example.com");
      const res = await testApp.app.inject({
        method: "PUT",
        url: `/movimentacoes/${txn.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { valor: 999 },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe("INSUFFICIENT_PERMISSIONS");

      const [unchanged] = await testApp.client`
        SELECT valor FROM movimentacoes WHERE id = ${txn.id}
      `;
      expect(unchanged.valor).toBe("100.00");
    });

    it("rejects deleting a transaction from another account", async () => {
      const keyPair = await generateTestKeyPair();
      testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
      await testApp.truncateAll();
      await seedTipoCategorias(testApp);

      const userA = await createUser(testApp, "u-c", "c@example.com");
      const userB = await createUser(testApp, "u-d", "d@example.com");
      const contaA = await createAccount(testApp, userA, "Conta C");
      const contaB = await createAccount(testApp, userB, "Conta D");
      const catId = await createCategory(testApp, "Alimentação", "despesa");

      const tokenB = await makeToken(keyPair, "u-d", "d@example.com");
      const createRes = await testApp.app.inject({
        method: "POST",
        url: "/movimentacoes",
        headers: { authorization: `Bearer ${tokenB}` },
        payload: {
          contaId: contaB,
          tipo: "despesa",
          categoriaId: catId,
          valor: 200,
          data: "2024-01-20",
        },
      });
      const txn = JSON.parse(createRes.payload);

      const tokenA = await makeToken(keyPair, "u-c", "c@example.com");
      const res = await testApp.app.inject({
        method: "DELETE",
        url: `/movimentacoes/${txn.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(403);

      const [remaining] = await testApp.client`
        SELECT id FROM movimentacoes WHERE id = ${txn.id}
      `;
      expect(remaining).toBeDefined();
    });
  });

  describe("Debts", () => {
    it("rejects deleting a debt from another account", async () => {
      const keyPair = await generateTestKeyPair();
      testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
      await testApp.truncateAll();
      await seedTipoCategorias(testApp);

      const userA = await createUser(testApp, "u-e", "e@example.com");
      const userB = await createUser(testApp, "u-f", "f@example.com");
      const contaA = await createAccount(testApp, userA, "Conta E");
      const contaB = await createAccount(testApp, userB, "Conta F");
      const catId = await createCategory(testApp, "Cartão", "divida");

      const tokenB = await makeToken(keyPair, "u-f", "f@example.com");
      const createRes = await testApp.app.inject({
        method: "POST",
        url: "/dividas",
        headers: { authorization: `Bearer ${tokenB}` },
        payload: {
          contaId: contaB,
          categoriaId: catId,
          descricao: "Dívida B",
          valorTotal: 1000,
          totalParcelas: 2,
          dataInicio: "2024-01-01",
        },
      });
      const divida = JSON.parse(createRes.payload);

      const tokenA = await makeToken(keyPair, "u-e", "e@example.com");
      const res = await testApp.app.inject({
        method: "DELETE",
        url: `/dividas/${divida.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(403);

      const [remaining] = await testApp.client`
        SELECT id FROM dividas WHERE id = ${divida.id}
      `;
      expect(remaining).toBeDefined();
    });

    it("rejects paying an installment from another account", async () => {
      const keyPair = await generateTestKeyPair();
      testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
      await testApp.truncateAll();
      await seedTipoCategorias(testApp);

      const userA = await createUser(testApp, "u-g", "g@example.com");
      const userB = await createUser(testApp, "u-h", "h@example.com");
      const contaA = await createAccount(testApp, userA, "Conta G");
      const contaB = await createAccount(testApp, userB, "Conta H");
      const catId = await createCategory(testApp, "Cartão", "divida");

      const tokenB = await makeToken(keyPair, "u-h", "h@example.com");
      const createRes = await testApp.app.inject({
        method: "POST",
        url: "/dividas",
        headers: { authorization: `Bearer ${tokenB}` },
        payload: {
          contaId: contaB,
          categoriaId: catId,
          descricao: "Dívida B",
          valorTotal: 100,
          totalParcelas: 1,
          dataInicio: "2024-01-01",
        },
      });
      const divida = JSON.parse(createRes.payload);

      const tokenA = await makeToken(keyPair, "u-g", "g@example.com");
      const res = await testApp.app.inject({
        method: "PATCH",
        url: `/dividas/${divida.id}/parcelas/${divida.parcelas[0].id}/pagamento`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { dataPagamento: "2024-01-15" },
      });

      expect(res.statusCode).toBe(403);

      const [unpaid] = await testApp.client`
        SELECT data_pagamento FROM parcelas_divida WHERE id = ${divida.parcelas[0].id}
      `;
      expect(unpaid.data_pagamento).toBeNull();
    });
  });
});

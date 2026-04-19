import { describe, it, expect, afterEach } from "vitest";
import type { TestApp } from "./helpers/setup.js";
import {
  setupAuthedApp,
  seedTipoCategorias,
  createUser,
  createAccountForUser,
  createCategoriaBySlug,
  type AuthedTestApp,
} from "./helpers/fixtures.js";

interface TwoAccountFixture {
  authed: AuthedTestApp;
  userAId: string;
  userBId: string;
  contaAId: string;
  contaBId: string;
  categoriaId: string;
}

describe("API HTTP IDOR protection", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  async function setupTwoAccounts(
    aIdp: string,
    aEmail: string,
    bIdp: string,
    bEmail: string,
    categoriaNome: string,
    categoriaSlug: string
  ): Promise<TwoAccountFixture> {
    const authed = await setupAuthedApp();
    testApp = authed.testApp;
    await seedTipoCategorias(testApp);

    const userAId = await createUser(testApp, aIdp, aEmail);
    const userBId = await createUser(testApp, bIdp, bEmail);
    const contaAId = await createAccountForUser(testApp, userAId, `Conta ${aIdp}`);
    const contaBId = await createAccountForUser(testApp, userBId, `Conta ${bIdp}`);
    const categoriaId = await createCategoriaBySlug(testApp, categoriaNome, categoriaSlug);

    return { authed, userAId, userBId, contaAId, contaBId, categoriaId };
  }

  describe("Transactions", () => {
    it("rejects updating a transaction from another account", async () => {
      const fx = await setupTwoAccounts(
        "u-a", "a@example.com", "u-b", "b@example.com", "Alimentação", "despesa"
      );

      const tokenB = await fx.authed.signToken("u-b", "b@example.com");
      const createRes = await testApp.app.inject({
        method: "POST",
        url: "/movimentacoes",
        headers: { authorization: `Bearer ${tokenB}` },
        payload: {
          contaId: fx.contaBId,
          tipo: "despesa",
          categoriaId: fx.categoriaId,
          valor: 100,
          data: "2024-01-20",
        },
      });
      const txn = JSON.parse(createRes.payload);

      const tokenA = await fx.authed.signToken("u-a", "a@example.com");
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
      const fx = await setupTwoAccounts(
        "u-c", "c@example.com", "u-d", "d@example.com", "Alimentação", "despesa"
      );

      const tokenB = await fx.authed.signToken("u-d", "d@example.com");
      const createRes = await testApp.app.inject({
        method: "POST",
        url: "/movimentacoes",
        headers: { authorization: `Bearer ${tokenB}` },
        payload: {
          contaId: fx.contaBId,
          tipo: "despesa",
          categoriaId: fx.categoriaId,
          valor: 200,
          data: "2024-01-20",
        },
      });
      const txn = JSON.parse(createRes.payload);

      const tokenA = await fx.authed.signToken("u-c", "c@example.com");
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
    async function createDividaAsB(
      fx: TwoAccountFixture,
      bIdp: string,
      bEmail: string,
      valorTotal: number,
      totalParcelas: number
    ) {
      const tokenB = await fx.authed.signToken(bIdp, bEmail);
      const createRes = await testApp.app.inject({
        method: "POST",
        url: "/dividas",
        headers: { authorization: `Bearer ${tokenB}` },
        payload: {
          contaId: fx.contaBId,
          categoriaId: fx.categoriaId,
          descricao: "Dívida B",
          valorTotal,
          totalParcelas,
          dataInicio: "2024-01-01",
        },
      });
      return JSON.parse(createRes.payload);
    }

    it("rejects deleting a debt from another account", async () => {
      const fx = await setupTwoAccounts(
        "u-e", "e@example.com", "u-f", "f@example.com", "Cartão", "divida"
      );
      const divida = await createDividaAsB(fx, "u-f", "f@example.com", 1000, 2);

      const tokenA = await fx.authed.signToken("u-e", "e@example.com");
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
      const fx = await setupTwoAccounts(
        "u-g", "g@example.com", "u-h", "h@example.com", "Cartão", "divida"
      );
      const divida = await createDividaAsB(fx, "u-h", "h@example.com", 100, 1);

      const tokenA = await fx.authed.signToken("u-g", "g@example.com");
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

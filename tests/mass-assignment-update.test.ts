import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  setupAuthedApp,
  seedTipoCategorias,
  createUser,
  createAccountForUser,
  createCategoriaBySlug,
} from "./helpers/fixtures.js";
import { updateAccount } from "../src/services/account-service.js";
import { updateTransaction } from "../src/services/transaction-service.js";

describe("Mass Assignment Protection in Updates", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  describe("Account Update", () => {
    it("PATCH /contas/:id ignores protected fields (createdAt, id)", async () => {
      const authed = await setupAuthedApp();
      testApp = authed.testApp;
      await seedTipoCategorias(testApp);
      const userId = await createUser(testApp, "acc-user1", "acc1@example.com");
      const contaId = await createAccountForUser(testApp, userId, "Conta Original");

      const [original] = await testApp.client`
        SELECT created_at, id FROM contas WHERE id = ${contaId}
      `;
      const originalCreatedAt = original.created_at;
      const originalId = original.id;

      const token = await authed.signToken("acc-user1", "acc1@example.com");
      const res = await testApp.app.inject({
        method: "PATCH",
        url: `/contas/${contaId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          nome: "Conta Alterada",
          createdAt: "2099-01-01T00:00:00Z",
          id: "00000000-0000-0000-0000-000000000000",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.nome).toBe("Conta Alterada");

      const [afterUpdate] = await testApp.client`
        SELECT created_at, id FROM contas WHERE id = ${contaId}
      `;
      expect(afterUpdate.created_at).toEqual(originalCreatedAt);
      expect(afterUpdate.id).toEqual(originalId);
    });

    it("service updateAccount ignores protected fields", async () => {
      testApp = await createTestApp({});
      await testApp.truncateAll();
      await seedTipoCategorias(testApp);
      const userId = await createUser(testApp, "acc-user2", "acc2@example.com");
      const contaId = await createAccountForUser(testApp, userId, "Conta Service");

      const [original] = await testApp.client`
        SELECT created_at, id FROM contas WHERE id = ${contaId}
      `;
      const originalCreatedAt = original.created_at;
      const originalId = original.id;

      await updateAccount(contaId, {
        nome: "Conta Service Alterada",
        createdAt: new Date("2099-01-01T00:00:00Z"),
        id: "00000000-0000-0000-0000-000000000000",
      } as any);

      const [afterUpdate] = await testApp.client`
        SELECT created_at, id FROM contas WHERE id = ${contaId}
      `;
      expect(afterUpdate.created_at).toEqual(originalCreatedAt);
      expect(afterUpdate.id).toEqual(originalId);
    });
  });

  describe("Transaction Update", () => {
    it("PUT /movimentacoes/:id strips unknown fields (createdAt, usuarioId)", async () => {
      const authed = await setupAuthedApp();
      testApp = authed.testApp;
      await seedTipoCategorias(testApp);
      const userId = await createUser(testApp, "tx-user1", "tx1@example.com");
      const contaId = await createAccountForUser(testApp, userId, "Conta TX");
      const categoriaId = await createCategoriaBySlug(testApp, "Alimentação", "despesa");

      const token = await authed.signToken("tx-user1", "tx1@example.com");

      const createRes = await testApp.app.inject({
        method: "POST",
        url: "/movimentacoes",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          contaId,
          tipo: "despesa",
          categoriaId,
          descricao: "Supermercado",
          valor: 100,
          data: "2024-01-20",
        },
      });
      const created = JSON.parse(createRes.payload);

      const [original] = await testApp.client`
        SELECT created_at, usuario_id FROM movimentacoes WHERE id = ${created.id}
      `;
      const originalCreatedAt = original.created_at;
      const originalUsuarioId = original.usuario_id;

      const res = await testApp.app.inject({
        method: "PUT",
        url: `/movimentacoes/${created.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          valor: 200,
          createdAt: "2099-01-01T00:00:00Z",
          usuarioId: "00000000-0000-0000-0000-000000000000",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.valor).toBe("200.00");

      const [afterUpdate] = await testApp.client`
        SELECT created_at, usuario_id FROM movimentacoes WHERE id = ${created.id}
      `;
      expect(afterUpdate.created_at).toEqual(originalCreatedAt);
      expect(afterUpdate.usuario_id).toEqual(originalUsuarioId);
    });

    it("service updateTransaction ignores protected fields", async () => {
      testApp = await createTestApp({});
      await testApp.truncateAll();
      await seedTipoCategorias(testApp);
      const userId = await createUser(testApp, "tx-user2", "tx2@example.com");
      const contaId = await createAccountForUser(testApp, userId, "Conta TX Service");
      const categoriaId = await createCategoriaBySlug(testApp, "Alimentação", "despesa");

      const [tx] = await testApp.client`
        INSERT INTO movimentacoes (conta_id, usuario_id, categoria_id, descricao, valor, data, recorrente)
        VALUES (${contaId}, ${userId}, ${categoriaId}, 'Teste', 100, '2024-01-20', false)
        RETURNING id
      `;

      const [original] = await testApp.client`
        SELECT created_at, usuario_id FROM movimentacoes WHERE id = ${tx.id}
      `;
      const originalCreatedAt = original.created_at;
      const originalUsuarioId = original.usuario_id;

      await updateTransaction(tx.id as string, {
        valor: 200,
        createdAt: new Date("2099-01-01T00:00:00Z"),
        usuarioId: "00000000-0000-0000-0000-000000000000",
      } as any);

      const [afterUpdate] = await testApp.client`
        SELECT created_at, usuario_id FROM movimentacoes WHERE id = ${tx.id}
      `;
      expect(afterUpdate.created_at).toEqual(originalCreatedAt);
      expect(afterUpdate.usuario_id).toEqual(originalUsuarioId);
    });

    it("ignores nested objects containing unknown/protected fields", async () => {
      const authed = await setupAuthedApp();
      testApp = authed.testApp;
      await seedTipoCategorias(testApp);
      const userId = await createUser(testApp, "tx-user3", "tx3@example.com");
      const contaId = await createAccountForUser(testApp, userId, "Conta TX Nested");
      const categoriaId = await createCategoriaBySlug(testApp, "Alimentação", "despesa");

      const token = await authed.signToken("tx-user3", "tx3@example.com");

      const createRes = await testApp.app.inject({
        method: "POST",
        url: "/movimentacoes",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          contaId,
          tipo: "despesa",
          categoriaId,
          descricao: "Supermercado",
          valor: 100,
          data: "2024-01-20",
        },
      });
      const created = JSON.parse(createRes.payload);

      const [original] = await testApp.client`
        SELECT valor, descricao FROM movimentacoes WHERE id = ${created.id}
      `;

      const res = await testApp.app.inject({
        method: "PUT",
        url: `/movimentacoes/${created.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          valor: 250,
          metadata: {
            createdAt: "2099-01-01T00:00:00Z",
            usuarioId: "00000000-0000-0000-0000-000000000000",
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.valor).toBe("250.00");

      const [afterUpdate] = await testApp.client`
        SELECT valor, descricao FROM movimentacoes WHERE id = ${created.id}
      `;
      expect(afterUpdate.valor).toBe("250.00");
      expect(afterUpdate.descricao).toBe(original.descricao);
    });
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";

describe("Debts CRUD", () => {
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

  async function addViewer(app: TestApp, contaId: string, viewerId: string) {
    await app.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${contaId}, ${viewerId}, 'viewer')
    `;
  }

  async function makeToken(keyPair: Awaited<ReturnType<typeof generateTestKeyPair>>, idProvedor: string, email: string) {
    return signTestToken(keyPair, { sub: idProvedor, email, name: idProvedor });
  }

  // ──────────────────────────────────────────────────────────
  // POST /dividas
  // ──────────────────────────────────────────────────────────

  it("creates a debt with exact division (1200 / 3)", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user1", "d-user1@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D1");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user1", "d-user1@example.com");

    const res = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Cartão de crédito",
        valorTotal: 1200,
        totalParcelas: 3,
        dataInicio: "2024-01-10",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.total_parcelas).toBe(3);
    expect(body.parcelas).toHaveLength(3);
    expect(body.parcelas[0].valor).toBe("400.00");
    expect(body.parcelas[1].valor).toBe("400.00");
    expect(body.parcelas[2].valor).toBe("400.00");
    const total = body.parcelas.reduce((acc: number, p: { valor: string }) => acc + parseFloat(p.valor), 0);
    expect(total).toBeCloseTo(1200, 2);
  });

  it("creates a debt with residue (1000 / 3)", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user2", "d-user2@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D2");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user2", "d-user2@example.com");

    const res = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Parcelamento",
        valorTotal: 1000,
        totalParcelas: 3,
        dataInicio: "2024-02-01",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.parcelas).toHaveLength(3);
    // 1000/3 = 333.33 truncated, last absorbs residue
    expect(body.parcelas[0].valor).toBe("333.33");
    expect(body.parcelas[1].valor).toBe("333.33");
    expect(body.parcelas[2].valor).toBe("333.34");
    const total = body.parcelas.reduce((acc: number, p: { valor: string }) => acc + parseFloat(p.valor), 0);
    expect(Math.round(total * 100)).toBe(100000);
  });

  it("rejects categoria of wrong type", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user3", "d-user3@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D3");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");
    const token = await makeToken(keyPair, "d-user3", "d-user3@example.com");

    const res = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Teste",
        valorTotal: 100,
        totalParcelas: 1,
        dataInicio: "2024-01-01",
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("rejects valor_total <= 0", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user4", "d-user4@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D4");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user4", "d-user4@example.com");

    const res = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Teste",
        valorTotal: 0,
        totalParcelas: 1,
        dataInicio: "2024-01-01",
      },
    });

    expect(res.statusCode).toBe(422);
  });

  it("rejects total_parcelas < 1", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user5", "d-user5@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D5");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user5", "d-user5@example.com");

    const res = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Teste",
        valorTotal: 100,
        totalParcelas: 0,
        dataInicio: "2024-01-01",
      },
    });

    expect(res.statusCode).toBe(422);
  });

  it("returns 403 for viewer trying to create debt", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const ownerId = await createUser(testApp, "d-owner1", "d-owner1@example.com");
    const viewerId = await createUser(testApp, "d-viewer1", "d-viewer1@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta D6");
    await addViewer(testApp, contaId, viewerId);
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-viewer1", "d-viewer1@example.com");

    const res = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Teste",
        valorTotal: 100,
        totalParcelas: 1,
        dataInicio: "2024-01-01",
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it("generates due dates at end of month when starting on Jan 31 (addMonths normalises)", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user6", "d-user6@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D7");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user6", "d-user6@example.com");

    const res = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Teste fim de mês",
        valorTotal: 300,
        totalParcelas: 3,
        dataInicio: "2024-01-31",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.parcelas[0].data_vencimento).toMatch(/^2024-01-31/);
    // Feb 31 → Feb 29 (2024 is leap year) or Feb 28
    expect(body.parcelas[1].data_vencimento).toMatch(/^2024-02-2[89]/);
    expect(body.parcelas[2].data_vencimento).toMatch(/^2024-03-3[01]/);
  });

  // ──────────────────────────────────────────────────────────
  // GET /dividas
  // ──────────────────────────────────────────────────────────

  it("lists debts with pagination", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user7", "d-user7@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D8");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user7", "d-user7@example.com");

    for (let i = 0; i < 3; i++) {
      await testApp.app.inject({
        method: "POST",
        url: "/dividas",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          contaId,
          categoriaId,
          descricao: `Dívida ${i + 1}`,
          valorTotal: 100 * (i + 1),
          totalParcelas: 2,
          dataInicio: "2024-01-01",
        },
      });
    }

    const res = await testApp.app.inject({
      method: "GET",
      url: `/dividas?contaId=${contaId}&page=1&limit=2`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(3);
    expect(body.pagination.totalPages).toBe(2);
    expect(body.pagination.hasNext).toBe(true);
  });

  it("filters debts by status=pendente", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user8", "d-user8@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D9");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user8", "d-user8@example.com");

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Pendente",
        valorTotal: 100,
        totalParcelas: 1,
        dataInicio: "2024-01-01",
      },
    });
    const criada = JSON.parse(createRes.payload);

    // Pay the debt to make it "quitada"
    await testApp.app.inject({
      method: "PATCH",
      url: `/dividas/${criada.id}/parcelas/${criada.parcelas[0].id}/pagamento`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dataPagamento: "2024-01-15" },
    });

    // Create another pending debt
    await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Pendente 2",
        valorTotal: 200,
        totalParcelas: 2,
        dataInicio: "2024-02-01",
      },
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: `/dividas?contaId=${contaId}&status=pendente`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.every((d: { parcelas_pendentes: number }) => d.parcelas_pendentes > 0)).toBe(true);
  });

  it("filters debts by status=quitada", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user9", "d-user9@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D10");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user9", "d-user9@example.com");

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Para quitar",
        valorTotal: 100,
        totalParcelas: 1,
        dataInicio: "2024-01-01",
      },
    });
    const criada = JSON.parse(createRes.payload);

    await testApp.app.inject({
      method: "PATCH",
      url: `/dividas/${criada.id}/parcelas/${criada.parcelas[0].id}/pagamento`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dataPagamento: "2024-01-10" },
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: `/dividas?contaId=${contaId}&status=quitada`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].parcelas_pendentes).toBe(0);
  });

  it("returns 422 when listing without contaId", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await createUser(testApp, "d-user10", "d-user10@example.com");
    const token = await makeToken(keyPair, "d-user10", "d-user10@example.com");

    const res = await testApp.app.inject({
      method: "GET",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.payload).code).toBe("VALIDATION_ERROR");
  });

  it("returns 403 when listing without account association", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const ownerId = await createUser(testApp, "d-owner2", "d-owner2@example.com");
    const otherId = await createUser(testApp, "d-other1", "d-other1@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta D11");
    const token = await makeToken(keyPair, "d-other1", "d-other1@example.com");

    const res = await testApp.app.inject({
      method: "GET",
      url: `/dividas?contaId=${contaId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  // ──────────────────────────────────────────────────────────
  // DELETE /dividas/:id
  // ──────────────────────────────────────────────────────────

  it("deletes a debt with no paid installments", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user11", "d-user11@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D12");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user11", "d-user11@example.com");

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Para deletar",
        valorTotal: 200,
        totalParcelas: 2,
        dataInicio: "2024-01-01",
      },
    });
    const criada = JSON.parse(createRes.payload);

    const delRes = await testApp.app.inject({
      method: "DELETE",
      url: `/dividas/${criada.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(delRes.statusCode).toBe(200);

    // Cascade: parcelas must also be gone
    const rows = await testApp.client`SELECT id FROM parcelas_divida WHERE divida_id = ${criada.id}`;
    expect(rows).toHaveLength(0);
  });

  it("returns 422 DEBT_HAS_PAYMENTS when a installment is paid", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user12", "d-user12@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D13");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user12", "d-user12@example.com");

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Dívida com parcela paga",
        valorTotal: 200,
        totalParcelas: 2,
        dataInicio: "2024-01-01",
      },
    });
    const criada = JSON.parse(createRes.payload);

    await testApp.app.inject({
      method: "PATCH",
      url: `/dividas/${criada.id}/parcelas/${criada.parcelas[0].id}/pagamento`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dataPagamento: "2024-01-10" },
    });

    const delRes = await testApp.app.inject({
      method: "DELETE",
      url: `/dividas/${criada.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(delRes.statusCode).toBe(422);
    expect(JSON.parse(delRes.payload).code).toBe("DEBT_HAS_PAYMENTS");
  });

  it("returns 404 for non-existent debt on DELETE", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await createUser(testApp, "d-user13", "d-user13@example.com");
    const token = await makeToken(keyPair, "d-user13", "d-user13@example.com");

    const res = await testApp.app.inject({
      method: "DELETE",
      url: "/dividas/00000000-0000-0000-0000-000000000000",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 403 for viewer on DELETE", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const ownerId = await createUser(testApp, "d-owner3", "d-owner3@example.com");
    const viewerId = await createUser(testApp, "d-viewer2", "d-viewer2@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta D14");
    await addViewer(testApp, contaId, viewerId);
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const ownerToken = await makeToken(keyPair, "d-owner3", "d-owner3@example.com");
    const viewerToken = await makeToken(keyPair, "d-viewer2", "d-viewer2@example.com");

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Teste viewer delete",
        valorTotal: 100,
        totalParcelas: 1,
        dataInicio: "2024-01-01",
      },
    });
    const criada = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "DELETE",
      url: `/dividas/${criada.id}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  // ──────────────────────────────────────────────────────────
  // PATCH /dividas/:id/parcelas/:parcelaId/pagamento
  // ──────────────────────────────────────────────────────────

  it("confirms payment and generates linked movimentacao", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user14", "d-user14@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D15");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user14", "d-user14@example.com");

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Financiamento",
        valorTotal: 600,
        totalParcelas: 2,
        dataInicio: "2024-03-01",
      },
    });
    const criada = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "PATCH",
      url: `/dividas/${criada.id}/parcelas/${criada.parcelas[0].id}/pagamento`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dataPagamento: "2024-03-10" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data_pagamento).toMatch(/^2024-03-10/);
    expect(body.movimentacao_gerada).toBeDefined();
    expect(body.movimentacao_gerada.parcela_divida_id).toBe(criada.parcelas[0].id);
    expect(body.movimentacao_gerada.valor).toBe("300.00");
  });

  it("returns 422 ALREADY_PAID when confirming a paid installment", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user15", "d-user15@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D16");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user15", "d-user15@example.com");

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Já paga",
        valorTotal: 100,
        totalParcelas: 1,
        dataInicio: "2024-01-01",
      },
    });
    const criada = JSON.parse(createRes.payload);

    await testApp.app.inject({
      method: "PATCH",
      url: `/dividas/${criada.id}/parcelas/${criada.parcelas[0].id}/pagamento`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dataPagamento: "2024-01-10" },
    });

    const res = await testApp.app.inject({
      method: "PATCH",
      url: `/dividas/${criada.id}/parcelas/${criada.parcelas[0].id}/pagamento`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dataPagamento: "2024-01-15" },
    });

    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.payload).code).toBe("ALREADY_PAID");
  });

  it("allows early payment (dataPagamento < dataVencimento)", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user16", "d-user16@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D17");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user16", "d-user16@example.com");

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Pagamento antecipado",
        valorTotal: 100,
        totalParcelas: 1,
        dataInicio: "2024-06-30",
      },
    });
    const criada = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "PATCH",
      url: `/dividas/${criada.id}/parcelas/${criada.parcelas[0].id}/pagamento`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dataPagamento: "2024-06-01" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data_pagamento).toMatch(/^2024-06-01/);
  });

  it("returns 404 for non-existent parcela on PATCH pagamento", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user17", "d-user17@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D18");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user17", "d-user17@example.com");

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Teste 404 parcela",
        valorTotal: 100,
        totalParcelas: 1,
        dataInicio: "2024-01-01",
      },
    });
    const criada = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "PATCH",
      url: `/dividas/${criada.id}/parcelas/00000000-0000-0000-0000-000000000000/pagamento`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dataPagamento: "2024-01-10" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 403 for viewer on PATCH pagamento", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const ownerId = await createUser(testApp, "d-owner4", "d-owner4@example.com");
    const viewerId = await createUser(testApp, "d-viewer3", "d-viewer3@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta D19");
    await addViewer(testApp, contaId, viewerId);
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const ownerToken = await makeToken(keyPair, "d-owner4", "d-owner4@example.com");
    const viewerToken = await makeToken(keyPair, "d-viewer3", "d-viewer3@example.com");

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Viewer PATCH test",
        valorTotal: 100,
        totalParcelas: 1,
        dataInicio: "2024-01-01",
      },
    });
    const criada = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "PATCH",
      url: `/dividas/${criada.id}/parcelas/${criada.parcelas[0].id}/pagamento`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { dataPagamento: "2024-01-10" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("movimentacao_gerada returns correct fields and parcela_divida_id is populated", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user18", "d-user18@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D20");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user18", "d-user18@example.com");

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Teste campos",
        valorTotal: 500,
        totalParcelas: 2,
        dataInicio: "2024-05-01",
      },
    });
    const criada = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "PATCH",
      url: `/dividas/${criada.id}/parcelas/${criada.parcelas[0].id}/pagamento`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dataPagamento: "2024-05-10" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    const mov = body.movimentacao_gerada;
    expect(mov.id).toBeDefined();
    expect(mov.tipo).toBe("despesa");
    expect(mov.valor).toBe("250.00");
    expect(mov.parcela_divida_id).toBe(criada.parcelas[0].id);
  });

  // ──────────────────────────────────────────────────────────
  // Invalidação de projeção (Task 5.7)
  // ──────────────────────────────────────────────────────────

  it("invalidates projections from data_inicio month on debt creation", async () => {
    const keyPair = await generateTestKeyPair();
    testApp = await createTestApp({ validateToken: await createTestJwksProvider(keyPair) });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "d-user19", "d-user19@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D21");
    const categoriaId = await createCategory(testApp, "Cartão", "divida");
    const token = await makeToken(keyPair, "d-user19", "d-user19@example.com");

    await testApp.client`
      INSERT INTO projecao (conta_id, mes, dados, status) VALUES
        (${contaId}, '2024-01', '{}'::jsonb, 'atualizada'),
        (${contaId}, '2024-02', '{}'::jsonb, 'atualizada'),
        (${contaId}, '2024-03', '{}'::jsonb, 'atualizada')
    `;

    const res = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Invalida projeção",
        valorTotal: 300,
        totalParcelas: 3,
        dataInicio: "2024-02-10",
      },
    });

    expect(res.statusCode).toBe(201);

    const projecoes = await testApp.client<{ mes: string; status: string }[]>`
      SELECT mes, status FROM projecao WHERE conta_id = ${contaId} ORDER BY mes
    `;
    const byMes = Object.fromEntries(projecoes.map((p) => [p.mes, p.status]));
    expect(byMes["2024-01"]).toBe("atualizada");
    expect(byMes["2024-02"]).toBe("invalidada");
    expect(byMes["2024-03"]).toBe("invalidada");
  });
});

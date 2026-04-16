import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";

describe("Transactions CRUD", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  async function createUser(
    app: TestApp,
    idProvedor: string,
    email: string,
    isAdmin = false
  ) {
    const [user] = await app.client`
      INSERT INTO usuarios (id_provedor, nome, email, is_admin)
      VALUES (${idProvedor}, ${email.split("@")[0]}, ${email}, ${isAdmin})
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
      INSERT INTO contas (nome, saldo_inicial)
      VALUES (${nome}, 0)
      RETURNING id
    `;
    await app.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${conta.id}, ${usuarioId}, 'owner')
    `;
    return conta.id as string;
  }

  it("creates a transaction as owner", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user1", "user1@example.com");
    const contaId = await createAccount(testApp, userId, "Conta A");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    const token = await signTestToken(keyPair, {
      sub: "user1",
      email: "user1@example.com",
      name: "User1",
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        descricao: "Supermercado",
        valor: 450,
        data: "2024-01-20",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.tipo).toBe("despesa");
    expect(body.categoria.id).toBe(categoriaId);
    expect(body.valor).toBe("450.00");
    expect(body.recorrente).toBe(false);
    expect(body.usuario.id).toBe(userId);
  });

  it("returns 422 when tipo does not match categoria", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user2", "user2@example.com");
    const contaId = await createAccount(testApp, userId, "Conta B");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    const token = await signTestToken(keyPair, {
      sub: "user2",
      email: "user2@example.com",
      name: "User2",
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "receita",
        categoriaId,
        valor: 100,
        data: "2024-01-20",
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("returns 422 when categoria does not exist", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user3", "user3@example.com");
    const contaId = await createAccount(testApp, userId, "Conta C");

    const token = await signTestToken(keyPair, {
      sub: "user3",
      email: "user3@example.com",
      name: "User3",
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId: "00000000-0000-0000-0000-000000000000",
        valor: 100,
        data: "2024-01-20",
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("returns 422 when data_fim is provided without recorrente", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user4", "user4@example.com");
    const contaId = await createAccount(testApp, userId, "Conta D");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    const token = await signTestToken(keyPair, {
      sub: "user4",
      email: "user4@example.com",
      name: "User4",
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        valor: 100,
        data: "2024-01-20",
        recorrente: false,
        data_fim: "2024-12-31",
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("blocks viewer from creating transaction", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const ownerId = await createUser(testApp, "owner1", "owner1@example.com");
    const viewerId = await createUser(testApp, "viewer1", "viewer1@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta E");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    await testApp.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${contaId}, ${viewerId}, 'viewer')
    `;

    const viewerToken = await signTestToken(keyPair, {
      sub: "viewer1",
      email: "viewer1@example.com",
      name: "Viewer1",
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        valor: 100,
        data: "2024-01-20",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("updates a transaction as owner", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user5", "user5@example.com");
    const contaId = await createAccount(testApp, userId, "Conta F");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    const token = await signTestToken(keyPair, {
      sub: "user5",
      email: "user5@example.com",
      name: "User5",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        valor: 100,
        data: "2024-01-20",
      },
    });
    const created = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "PUT",
      url: `/movimentacoes/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { valor: 200 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.valor).toBe("200.00");
  });

  it("cancels recurrence and clears data_fim", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user6", "user6@example.com");
    const contaId = await createAccount(testApp, userId, "Conta G");
    const categoriaId = await createCategory(testApp, "Salário", "receita");

    const token = await signTestToken(keyPair, {
      sub: "user6",
      email: "user6@example.com",
      name: "User6",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "receita",
        categoriaId,
        valor: 5000,
        data: "2024-01-01",
        recorrente: true,
        data_fim: "2024-12-31",
      },
    });
    const created = JSON.parse(createRes.payload);
    expect(created.recorrente).toBe(true);
    expect(created.dataFim).not.toBeNull();

    const res = await testApp.app.inject({
      method: "PUT",
      url: `/movimentacoes/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { recorrente: false },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.recorrente).toBe(false);
    expect(body.dataFim).toBeNull();
  });

  it("sets recurrence end date", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user7", "user7@example.com");
    const contaId = await createAccount(testApp, userId, "Conta H");
    const categoriaId = await createCategory(testApp, "Salário", "receita");

    const token = await signTestToken(keyPair, {
      sub: "user7",
      email: "user7@example.com",
      name: "User7",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "receita",
        categoriaId,
        valor: 5000,
        data: "2024-01-01",
        recorrente: true,
      },
    });
    const created = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "PUT",
      url: `/movimentacoes/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { data_fim: "2025-06-30" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.dataFim).toBeDefined();
  });

  it("returns 404 when updating non-existent transaction", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user8", "user8@example.com");
    await createAccount(testApp, userId, "Conta I");

    const token = await signTestToken(keyPair, {
      sub: "user8",
      email: "user8@example.com",
      name: "User8",
    });

    const res = await testApp.app.inject({
      method: "PUT",
      url: "/movimentacoes/00000000-0000-0000-0000-000000000000",
      headers: { authorization: `Bearer ${token}` },
      payload: { valor: 200 },
    });

    expect(res.statusCode).toBe(404);
  });

  it("deletes a transaction as owner", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user9", "user9@example.com");
    const contaId = await createAccount(testApp, userId, "Conta J");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    const token = await signTestToken(keyPair, {
      sub: "user9",
      email: "user9@example.com",
      name: "User9",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        valor: 100,
        data: "2024-01-20",
      },
    });
    const created = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "DELETE",
      url: `/movimentacoes/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it("returns 422 when deleting system-generated transaction", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user10", "user10@example.com");
    const contaId = await createAccount(testApp, userId, "Conta K");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");
    const divCatId = await createCategory(testApp, "Financiamento", "divida");

    const token = await signTestToken(keyPair, {
      sub: "user10",
      email: "user10@example.com",
      name: "User10",
    });

    // Create a real debt + parcela to satisfy the FK constraint
    const [dividaRow] = await testApp.client`
      INSERT INTO dividas (conta_id, usuario_id, categoria_id, descricao, valor_total, total_parcelas, valor_parcela, data_inicio)
      VALUES (${contaId}, ${userId}, ${divCatId}, 'Teste FK', 100, 1, 100, '2024-01-20')
      RETURNING id
    `;
    const [parcelaRow] = await testApp.client`
      INSERT INTO parcelas_divida (divida_id, numero_parcela, valor, data_vencimento)
      VALUES (${dividaRow.id}, 1, 100, '2024-01-20')
      RETURNING id
    `;

    const [created] = await testApp.client`
      INSERT INTO movimentacoes (conta_id, usuario_id, categoria_id, descricao, valor, data, recorrente, parcela_divida_id)
      VALUES (${contaId}, ${userId}, ${categoriaId}, 'Parcela', 100, '2024-01-20', false, ${parcelaRow.id})
      RETURNING id
    `;

    const res = await testApp.app.inject({
      method: "DELETE",
      url: `/movimentacoes/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("SYSTEM_GENERATED_RESOURCE");
  });

  it("blocks viewer from deleting transaction", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const ownerId = await createUser(testApp, "owner2", "owner2@example.com");
    const viewerId = await createUser(testApp, "viewer2", "viewer2@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta L");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    await testApp.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${contaId}, ${viewerId}, 'viewer')
    `;

    const ownerToken = await signTestToken(keyPair, {
      sub: "owner2",
      email: "owner2@example.com",
      name: "Owner2",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        valor: 100,
        data: "2024-01-20",
      },
    });
    const created = JSON.parse(createRes.payload);

    const viewerToken = await signTestToken(keyPair, {
      sub: "viewer2",
      email: "viewer2@example.com",
      name: "Viewer2",
    });

    const res = await testApp.app.inject({
      method: "DELETE",
      url: `/movimentacoes/${created.id}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("lists transactions with filters and pagination", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user11", "user11@example.com");
    const contaId = await createAccount(testApp, userId, "Conta M");
    const despesaId = await createCategory(testApp, "Alimentação", "despesa");
    const receitaId = await createCategory(testApp, "Salário", "receita");

    const token = await signTestToken(keyPair, {
      sub: "user11",
      email: "user11@example.com",
      name: "User11",
    });

    await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId: despesaId,
        descricao: "Supermercado",
        valor: 100,
        data: "2024-01-15",
      },
    });
    await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "receita",
        categoriaId: receitaId,
        descricao: "Salário",
        valor: 5000,
        data: "2024-01-01",
      },
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: `/movimentacoes?contaId=${contaId}&tipo=despesa&data_inicio=2024-01-01&data_fim=2024-01-31&page=1&limit=10`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBe(1);
    expect(body.data[0].tipo).toBe("despesa");
    expect(body.pagination).toBeDefined();
  });

  it("searches transactions by description", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user12", "user12@example.com");
    const contaId = await createAccount(testApp, userId, "Conta N");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    const token = await signTestToken(keyPair, {
      sub: "user12",
      email: "user12@example.com",
      name: "User12",
    });

    await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        descricao: "Supermercado Extra",
        valor: 100,
        data: "2024-01-15",
      },
    });
    await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        descricao: "Farmácia",
        valor: 50,
        data: "2024-01-16",
      },
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: `/movimentacoes?contaId=${contaId}&busca=super`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBe(1);
    expect(body.data[0].descricao).toBe("Supermercado Extra");
  });

  it("returns 422 when listing without contaId", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await createUser(testApp, "user13", "user13@example.com");

    const token = await signTestToken(keyPair, {
      sub: "user13",
      email: "user13@example.com",
      name: "User13",
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects POST /movimentacoes with valor=0", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user14", "user14@example.com");
    const contaId = await createAccount(testApp, userId, "Conta P");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    const token = await signTestToken(keyPair, {
      sub: "user14",
      email: "user14@example.com",
      name: "User14",
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        valor: 0,
        data: "2024-01-20",
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("rejects POST /movimentacoes with negative valor", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user15", "user15@example.com");
    const contaId = await createAccount(testApp, userId, "Conta Q");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    const token = await signTestToken(keyPair, {
      sub: "user15",
      email: "user15@example.com",
      name: "User15",
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        valor: -50,
        data: "2024-01-20",
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("rejects PUT /movimentacoes/:id with valor=0", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user16", "user16@example.com");
    const contaId = await createAccount(testApp, userId, "Conta R");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    const token = await signTestToken(keyPair, {
      sub: "user16",
      email: "user16@example.com",
      name: "User16",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        valor: 100,
        data: "2024-01-20",
      },
    });
    const created = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "PUT",
      url: `/movimentacoes/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { valor: 0 },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("rejects PUT /movimentacoes/:id with negative valor", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user17", "user17@example.com");
    const contaId = await createAccount(testApp, userId, "Conta S");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    const token = await signTestToken(keyPair, {
      sub: "user17",
      email: "user17@example.com",
      name: "User17",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        valor: 100,
        data: "2024-01-20",
      },
    });
    const created = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "PUT",
      url: `/movimentacoes/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { valor: -10 },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("invalidates projections from transaction month onwards on create", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user18", "user18@example.com");
    const contaId = await createAccount(testApp, userId, "Conta T");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    await testApp.client`
      INSERT INTO projecao (conta_id, mes, dados, status) VALUES
        (${contaId}, '2023-12', '{}'::jsonb, 'atualizada'),
        (${contaId}, '2024-01', '{}'::jsonb, 'atualizada'),
        (${contaId}, '2024-02', '{}'::jsonb, 'atualizada')
    `;

    const token = await signTestToken(keyPair, {
      sub: "user18",
      email: "user18@example.com",
      name: "User18",
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        valor: 100,
        data: "2024-01-15",
      },
    });

    expect(res.statusCode).toBe(201);

    const projections = await testApp.client<{ mes: string; status: string }[]>`
      SELECT mes, status FROM projecao WHERE conta_id = ${contaId} ORDER BY mes
    `;

    const statusByMes = Object.fromEntries(projections.map((p) => [p.mes, p.status]));
    expect(statusByMes["2023-12"]).toBe("atualizada");
    expect(statusByMes["2024-01"]).toBe("invalidada");
    expect(statusByMes["2024-02"]).toBe("invalidada");
  });

  it("invalidates projections from earliest month when transaction date moves backwards", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "user19", "user19@example.com");
    const contaId = await createAccount(testApp, userId, "Conta U");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    const token = await signTestToken(keyPair, {
      sub: "user19",
      email: "user19@example.com",
      name: "User19",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        valor: 100,
        data: "2024-05-10",
      },
    });
    const created = JSON.parse(createRes.payload);

    await testApp.client`
      INSERT INTO projecao (conta_id, mes, dados, status) VALUES
        (${contaId}, '2024-02', '{}'::jsonb, 'atualizada'),
        (${contaId}, '2024-03', '{}'::jsonb, 'atualizada'),
        (${contaId}, '2024-04', '{}'::jsonb, 'atualizada'),
        (${contaId}, '2024-05', '{}'::jsonb, 'atualizada'),
        (${contaId}, '2024-06', '{}'::jsonb, 'atualizada')
    `;

    const res = await testApp.app.inject({
      method: "PUT",
      url: `/movimentacoes/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { data: "2024-03-15" },
    });

    expect(res.statusCode).toBe(200);

    const projections = await testApp.client<{ mes: string; status: string }[]>`
      SELECT mes, status FROM projecao WHERE conta_id = ${contaId} ORDER BY mes
    `;

    const statusByMes = Object.fromEntries(projections.map((p) => [p.mes, p.status]));
    expect(statusByMes["2024-02"]).toBe("atualizada");
    expect(statusByMes["2024-03"]).toBe("invalidada");
    expect(statusByMes["2024-04"]).toBe("invalidada");
    expect(statusByMes["2024-05"]).toBe("invalidada");
    expect(statusByMes["2024-06"]).toBe("invalidada");
  });

  it("treats missing projecao table as no-op and still creates transaction", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await testApp.client.unsafe(`DROP TABLE IF EXISTS projecao`);
    try {
      await seedTipoCategorias(testApp);
      const userId = await createUser(testApp, "user20", "user20@example.com");
      const contaId = await createAccount(testApp, userId, "Conta V");
      const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

      const token = await signTestToken(keyPair, {
        sub: "user20",
        email: "user20@example.com",
        name: "User20",
      });

      const res = await testApp.app.inject({
        method: "POST",
        url: "/movimentacoes",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          contaId,
          tipo: "despesa",
          categoriaId,
          valor: 100,
          data: "2024-01-20",
        },
      });

      expect(res.statusCode).toBe(201);
    } finally {
      await testApp.client.unsafe(`
        CREATE TABLE IF NOT EXISTS projecao (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          conta_id uuid NOT NULL,
          mes varchar(7) NOT NULL,
          dados jsonb NOT NULL,
          status projecao_status DEFAULT 'atualizada' NOT NULL,
          recalculado_em timestamp with time zone DEFAULT now() NOT NULL,
          created_at timestamp with time zone DEFAULT now() NOT NULL,
          updated_at timestamp with time zone DEFAULT now() NOT NULL,
          CONSTRAINT projecao_conta_mes_unique UNIQUE(conta_id, mes),
          CONSTRAINT projecao_conta_id_contas_id_fk
            FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE CASCADE
        )
      `);
    }
  });

  it("returns 422 SYSTEM_GENERATED_RESOURCE when deleting movimentacao generated by debt payment", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const userId = await createUser(testApp, "sg-user1", "sg-user1@example.com");
    const contaId = await createAccount(testApp, userId, "Conta SG1");

    const token = await signTestToken(keyPair, {
      sub: "sg-user1",
      email: "sg-user1@example.com",
      name: "SgUser1",
    });

    // Create a debt category
    const [divCat] = await testApp.client`
      INSERT INTO categorias (nome, tipo_categoria_id)
      SELECT 'Financiamento', id FROM tipo_categorias WHERE slug = 'divida'
      RETURNING id
    `;
    const categoriaId = divCat.id as string;

    // Create a debt
    const debtRes = await testApp.app.inject({
      method: "POST",
      url: "/dividas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contaId,
        categoriaId,
        descricao: "Empréstimo",
        valorTotal: 100,
        totalParcelas: 1,
        dataInicio: "2024-04-01",
      },
    });
    expect(debtRes.statusCode).toBe(201);
    const divida = JSON.parse(debtRes.payload);

    // Confirm payment — this generates a system movimentacao
    const payRes = await testApp.app.inject({
      method: "PATCH",
      url: `/dividas/${divida.id}/parcelas/${divida.parcelas[0].id}/pagamento`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dataPagamento: "2024-04-05" },
    });
    expect(payRes.statusCode).toBe(200);
    const payBody = JSON.parse(payRes.payload);
    const movimentacaoId = payBody.movimentacao_gerada.id;

    // Attempt to delete the generated movimentacao — must return 422
    const delRes = await testApp.app.inject({
      method: "DELETE",
      url: `/movimentacoes/${movimentacaoId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(delRes.statusCode).toBe(422);
    expect(JSON.parse(delRes.payload).code).toBe("SYSTEM_GENERATED_RESOURCE");
  });

  it("allows viewer to list transactions", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const ownerId = await createUser(testApp, "owner3", "owner3@example.com");
    const viewerId = await createUser(testApp, "viewer3", "viewer3@example.com");
    const contaId = await createAccount(testApp, ownerId, "Conta O");
    const categoriaId = await createCategory(testApp, "Alimentação", "despesa");

    await testApp.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${contaId}, ${viewerId}, 'viewer')
    `;

    const ownerToken = await signTestToken(keyPair, {
      sub: "owner3",
      email: "owner3@example.com",
      name: "Owner3",
    });

    await testApp.app.inject({
      method: "POST",
      url: "/movimentacoes",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        contaId,
        tipo: "despesa",
        categoriaId,
        valor: 100,
        data: "2024-01-20",
      },
    });

    const viewerToken = await signTestToken(keyPair, {
      sub: "viewer3",
      email: "viewer3@example.com",
      name: "Viewer3",
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: `/movimentacoes?contaId=${contaId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBe(1);
  });
});

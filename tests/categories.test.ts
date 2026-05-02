import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";

describe("Categories CRUD", () => {
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

  it("creates category as admin", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    await createUser(testApp, "admin-user", "admin@example.com", true);

    const token = await signTestToken(keyPair, {
      sub: "admin-user",
      email: "admin@example.com",
      name: "Admin",
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/categorias",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Alimentação", tipo: "despesa" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.nome).toBe("Alimentação");
    expect(body.tipo).toBe("despesa");
    expect(body.id).toBeDefined();
  });

  it("returns 403 for non-admin creating category", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    await createUser(testApp, "regular-user", "regular@example.com", false);

    const token = await signTestToken(keyPair, {
      sub: "regular-user",
      email: "regular@example.com",
      name: "Regular",
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/categorias",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Alimentação", tipo: "despesa" },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("ADMIN_REQUIRED");
  });

  it("returns 422 for duplicate category", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    await createUser(testApp, "admin-user", "admin@example.com", true);

    const token = await signTestToken(keyPair, {
      sub: "admin-user",
      email: "admin@example.com",
      name: "Admin",
    });

    await testApp.app.inject({
      method: "POST",
      url: "/categorias",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Alimentação", tipo: "despesa" },
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/categorias",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Alimentação", tipo: "despesa" },
    });

    expect(res.statusCode).toBe(409);
  });

  it("lists categories without filters", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    await createUser(testApp, "admin-user", "admin@example.com", true);

    const token = await signTestToken(keyPair, {
      sub: "admin-user",
      email: "admin@example.com",
      name: "Admin",
    });

    await testApp.app.inject({
      method: "POST",
      url: "/categorias",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Alimentação", tipo: "despesa" },
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/categorias",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.pagination).toBeDefined();
  });

  it("filters categories by tipo", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    await createUser(testApp, "admin-user", "admin@example.com", true);

    const token = await signTestToken(keyPair, {
      sub: "admin-user",
      email: "admin@example.com",
      name: "Admin",
    });

    await testApp.app.inject({
      method: "POST",
      url: "/categorias",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Alimentação", tipo: "despesa" },
    });
    await testApp.app.inject({
      method: "POST",
      url: "/categorias",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Salário", tipo: "receita" },
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/categorias?tipo=despesa",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.every((c: { tipo: string }) => c.tipo === "despesa")).toBe(true);
  });

  it("searches categories by partial name", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    await createUser(testApp, "admin-user", "admin@example.com", true);

    const token = await signTestToken(keyPair, {
      sub: "admin-user",
      email: "admin@example.com",
      name: "Admin",
    });

    await testApp.app.inject({
      method: "POST",
      url: "/categorias",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Alimentação", tipo: "despesa" },
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/categorias?busca=alim",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBe(1);
    expect(body.data[0].nome).toBe("Alimentação");
  });

  it("updates category as admin", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    await createUser(testApp, "admin-user", "admin@example.com", true);

    const token = await signTestToken(keyPair, {
      sub: "admin-user",
      email: "admin@example.com",
      name: "Admin",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/categorias",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Alimentação", tipo: "despesa" },
    });
    const created = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "PUT",
      url: `/categorias/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Alimentação Atualizada", tipo: "despesa" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.nome).toBe("Alimentação Atualizada");
  });

  it("returns 403 for non-admin updating category", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const adminId = await createUser(testApp, "admin-user", "admin@example.com", true);
    await createUser(testApp, "regular-user", "regular@example.com", false);

    const adminToken = await signTestToken(keyPair, {
      sub: "admin-user",
      email: "admin@example.com",
      name: "Admin",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/categorias",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { nome: "Alimentação", tipo: "despesa" },
    });
    const created = JSON.parse(createRes.payload);

    const regularToken = await signTestToken(keyPair, {
      sub: "regular-user",
      email: "regular@example.com",
      name: "Regular",
    });

    const res = await testApp.app.inject({
      method: "PUT",
      url: `/categorias/${created.id}`,
      headers: { authorization: `Bearer ${regularToken}` },
      payload: { nome: "X", tipo: "despesa" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when updating non-existent category", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    await createUser(testApp, "admin-user", "admin@example.com", true);

    const token = await signTestToken(keyPair, {
      sub: "admin-user",
      email: "admin@example.com",
      name: "Admin",
    });

    const res = await testApp.app.inject({
      method: "PUT",
      url: "/categorias/00000000-0000-0000-0000-000000000000",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "X", tipo: "despesa" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("deletes category as admin without links", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    await createUser(testApp, "admin-user", "admin@example.com", true);

    const token = await signTestToken(keyPair, {
      sub: "admin-user",
      email: "admin@example.com",
      name: "Admin",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/categorias",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Temp", tipo: "despesa" },
    });
    const created = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "DELETE",
      url: `/categorias/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it("returns 422 when deleting category with linked records", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const adminId = await createUser(testApp, "admin-user", "admin@example.com", true);

    const token = await signTestToken(keyPair, {
      sub: "admin-user",
      email: "admin@example.com",
      name: "Admin",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/categorias",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Temp", tipo: "despesa" },
    });
    const created = JSON.parse(createRes.payload);

    const [conta] = await testApp.client`
      INSERT INTO contas (nome, saldo_inicial)
      VALUES ('Conta Temp', 0)
      RETURNING id
    `;
    await testApp.client`
      INSERT INTO movimentacoes (conta_id, usuario_id, categoria_id, valor, data)
      VALUES (${conta.id}, ${adminId}, ${created.id}, 100, '2024-01-01')
    `;

    const res = await testApp.app.inject({
      method: "DELETE",
      url: `/categorias/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("returns 403 for non-admin deleting category", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    const adminId = await createUser(testApp, "admin-user", "admin@example.com", true);
    await createUser(testApp, "regular-user", "regular@example.com", false);

    const adminToken = await signTestToken(keyPair, {
      sub: "admin-user",
      email: "admin@example.com",
      name: "Admin",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/categorias",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { nome: "Temp", tipo: "despesa" },
    });
    const created = JSON.parse(createRes.payload);

    const regularToken = await signTestToken(keyPair, {
      sub: "regular-user",
      email: "regular@example.com",
      name: "Regular",
    });

    const res = await testApp.app.inject({
      method: "DELETE",
      url: `/categorias/${created.id}`,
      headers: { authorization: `Bearer ${regularToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when deleting non-existent category", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await seedTipoCategorias(testApp);
    await createUser(testApp, "admin-user", "admin@example.com", true);

    const token = await signTestToken(keyPair, {
      sub: "admin-user",
      email: "admin@example.com",
      name: "Admin",
    });

    const res = await testApp.app.inject({
      method: "DELETE",
      url: "/categorias/00000000-0000-0000-0000-000000000000",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

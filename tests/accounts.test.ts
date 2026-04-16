import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";

describe("Accounts CRUD", () => {
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

  it("creates account with initial balance", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await createUser(testApp, "user1", "user1@example.com");

    const token = await signTestToken(keyPair, {
      sub: "user1",
      email: "user1@example.com",
      name: "User1",
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/contas",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Conta Casa", saldo_inicial: 5000 },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.nome).toBe("Conta Casa");
    expect(body.saldoInicial).toBe("5000.00");
    expect(body.papel).toBe("owner");
  });

  it("creates account without initial balance defaulting to 0.00", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await createUser(testApp, "user2", "user2@example.com");

    const token = await signTestToken(keyPair, {
      sub: "user2",
      email: "user2@example.com",
      name: "User2",
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: "/contas",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Conta Pessoal" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.saldoInicial).toBe("0.00");
  });

  it("lists accounts for the user", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    const userId = await createUser(testApp, "user3", "user3@example.com");

    const token = await signTestToken(keyPair, {
      sub: "user3",
      email: "user3@example.com",
      name: "User3",
    });

    await testApp.app.inject({
      method: "POST",
      url: "/contas",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Conta A" },
    });
    await testApp.app.inject({
      method: "POST",
      url: "/contas",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Conta B" },
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/contas",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBe(2);
    expect(body.data[0].papel).toBe("owner");
    expect(body.pagination).toBeDefined();
  });

  it("returns empty list when user has no accounts", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await createUser(testApp, "user4", "user4@example.com");

    const token = await signTestToken(keyPair, {
      sub: "user4",
      email: "user4@example.com",
      name: "User4",
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/contas",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toEqual([]);
  });

  it("searches accounts by name", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await createUser(testApp, "user5", "user5@example.com");

    const token = await signTestToken(keyPair, {
      sub: "user5",
      email: "user5@example.com",
      name: "User5",
    });

    await testApp.app.inject({
      method: "POST",
      url: "/contas",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Conta Casa" },
    });
    await testApp.app.inject({
      method: "POST",
      url: "/contas",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Conta Carro" },
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/contas?busca=Casa",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBe(1);
    expect(body.data[0].nome).toBe("Conta Casa");
  });

  it("allows owner to update account", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await createUser(testApp, "owner-user", "owner@example.com");

    const token = await signTestToken(keyPair, {
      sub: "owner-user",
      email: "owner@example.com",
      name: "Owner",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/contas",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Conta Velha" },
    });
    const created = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "PATCH",
      url: `/contas/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "Conta Nova" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.nome).toBe("Conta Nova");
  });

  it("blocks viewer from updating account", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    const ownerId = await createUser(testApp, "owner2", "owner2@example.com");
    const viewerId = await createUser(testApp, "viewer2", "viewer2@example.com");

    const ownerToken = await signTestToken(keyPair, {
      sub: "owner2",
      email: "owner2@example.com",
      name: "Owner2",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/contas",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { nome: "Conta Compartilhada" },
    });
    const created = JSON.parse(createRes.payload);

    await testApp.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${created.id}, ${viewerId}, 'viewer')
    `;

    const viewerToken = await signTestToken(keyPair, {
      sub: "viewer2",
      email: "viewer2@example.com",
      name: "Viewer2",
    });

    const res = await testApp.app.inject({
      method: "PATCH",
      url: `/contas/${created.id}`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { nome: "Hacked" },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("returns 404 when updating non-existent account", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await createUser(testApp, "user6", "user6@example.com");

    const token = await signTestToken(keyPair, {
      sub: "user6",
      email: "user6@example.com",
      name: "User6",
    });

    const res = await testApp.app.inject({
      method: "PATCH",
      url: "/contas/00000000-0000-0000-0000-000000000000",
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: "X" },
    });

    expect(res.statusCode).toBe(404);
  });
});

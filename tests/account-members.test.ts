import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";

describe("Account Members", () => {
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

  it("allows owner to associate a member", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await createUser(testApp, "owner", "owner@example.com");
    await createUser(testApp, "member", "member@example.com");

    const ownerToken = await signTestToken(keyPair, {
      sub: "owner",
      email: "owner@example.com",
      name: "Owner",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/contas",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { nome: "Conta Familia" },
    });
    const conta = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "POST",
      url: `/contas/${conta.id}/usuarios`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: "member@example.com", papel: "viewer" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.email).toBe("member@example.com");
    expect(body.papel).toBe("viewer");
  });

  it("blocks viewer from associating a member", async () => {
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
    const conta = JSON.parse(createRes.payload);

    await testApp.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${conta.id}, ${viewerId}, 'viewer')
    `;

    const viewerToken = await signTestToken(keyPair, {
      sub: "viewer2",
      email: "viewer2@example.com",
      name: "Viewer2",
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: `/contas/${conta.id}/usuarios`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { email: "x@example.com", papel: "viewer" },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("returns 404 for non-existent email", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await createUser(testApp, "owner3", "owner3@example.com");

    const ownerToken = await signTestToken(keyPair, {
      sub: "owner3",
      email: "owner3@example.com",
      name: "Owner3",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/contas",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { nome: "Conta" },
    });
    const conta = JSON.parse(createRes.payload);

    const res = await testApp.app.inject({
      method: "POST",
      url: `/contas/${conta.id}/usuarios`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: "missing@example.com", papel: "viewer" },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("returns 422 for duplicate association", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();
    await createUser(testApp, "owner4", "owner4@example.com");
    await createUser(testApp, "member4", "member4@example.com");

    const ownerToken = await signTestToken(keyPair, {
      sub: "owner4",
      email: "owner4@example.com",
      name: "Owner4",
    });

    const createRes = await testApp.app.inject({
      method: "POST",
      url: "/contas",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { nome: "Conta" },
    });
    const conta = JSON.parse(createRes.payload);

    await testApp.app.inject({
      method: "POST",
      url: `/contas/${conta.id}/usuarios`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: "member4@example.com", papel: "viewer" },
    });

    const res = await testApp.app.inject({
      method: "POST",
      url: `/contas/${conta.id}/usuarios`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: "member4@example.com", papel: "viewer" },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("DUPLICATE_RESOURCE");
  });
});

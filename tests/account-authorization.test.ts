import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";
import { requireAccountRole } from "../src/plugins/account-authorization.js";

describe("Account Authorization Middleware", () => {
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

  async function createConta(app: TestApp, nome: string) {
    const [conta] = await app.client`
      INSERT INTO contas (nome, saldo_inicial)
      VALUES (${nome}, 0)
      RETURNING id
    `;
    return conta.id as string;
  }

  async function associateUser(
    app: TestApp,
    contaId: string,
    usuarioId: string,
    papel: string
  ) {
    await app.client`
      INSERT INTO conta_usuarios (conta_id, usuario_id, papel)
      VALUES (${contaId}, ${usuarioId}, ${papel})
    `;
  }

  it("allows owner to access route requiring owner", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    const userId = await createUser(testApp, "owner-user", "owner@example.com");
    const contaId = await createConta(testApp, "Conta Owner");
    await associateUser(testApp, contaId, userId, "owner");

    const token = await signTestToken(keyPair, {
      sub: "owner-user",
      email: "owner@example.com",
      name: "Owner User",
    });

    testApp.app.get(
      "/contas/:contaId/owner-only",
      { onRequest: [requireAccountRole({ minRole: "owner" })] },
      async () => ({ ok: true })
    );

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/owner-only`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it("blocks viewer from accessing route requiring owner", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    const userId = await createUser(testApp, "viewer-user", "viewer@example.com");
    const contaId = await createConta(testApp, "Conta Viewer");
    await associateUser(testApp, contaId, userId, "viewer");

    const token = await signTestToken(keyPair, {
      sub: "viewer-user",
      email: "viewer@example.com",
      name: "Viewer User",
    });

    testApp.app.get(
      "/contas/:contaId/owner-only",
      { onRequest: [requireAccountRole({ minRole: "owner" })] },
      async () => ({ ok: true })
    );

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/owner-only`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("blocks user without association", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    await createUser(testApp, "unrelated-user", "unrelated@example.com");
    const contaId = await createConta(testApp, "Conta Privada");

    const token = await signTestToken(keyPair, {
      sub: "unrelated-user",
      email: "unrelated@example.com",
      name: "Unrelated User",
    });

    testApp.app.get(
      "/contas/:contaId/resource",
      { onRequest: [requireAccountRole({ minRole: "viewer" })] },
      async () => ({ ok: true })
    );

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/resource`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for non-existent conta", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    await createUser(testApp, "any-user", "any@example.com");

    const token = await signTestToken(keyPair, {
      sub: "any-user",
      email: "any@example.com",
      name: "Any User",
    });

    testApp.app.get(
      "/contas/:contaId/resource",
      { onRequest: [requireAccountRole({ minRole: "viewer" })] },
      async () => ({ ok: true })
    );

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/00000000-0000-0000-0000-000000000000/resource`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("allows owner on route requiring viewer", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    const userId = await createUser(testApp, "owner2-user", "owner2@example.com");
    const contaId = await createConta(testApp, "Conta Owner2");
    await associateUser(testApp, contaId, userId, "owner");

    const token = await signTestToken(keyPair, {
      sub: "owner2-user",
      email: "owner2@example.com",
      name: "Owner2 User",
    });

    testApp.app.get(
      "/contas/:contaId/viewer-ok",
      { onRequest: [requireAccountRole({ minRole: "viewer" })] },
      async () => ({ ok: true })
    );

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/viewer-ok`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it("allows viewer on route requiring viewer", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    const userId = await createUser(testApp, "viewer2-user", "viewer2@example.com");
    const contaId = await createConta(testApp, "Conta Viewer2");
    await associateUser(testApp, contaId, userId, "viewer");

    const token = await signTestToken(keyPair, {
      sub: "viewer2-user",
      email: "viewer2@example.com",
      name: "Viewer2 User",
    });

    testApp.app.get(
      "/contas/:contaId/viewer-ok",
      { onRequest: [requireAccountRole({ minRole: "viewer" })] },
      async () => ({ ok: true })
    );

    const res = await testApp.app.inject({
      method: "GET",
      url: `/contas/${contaId}/viewer-ok`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });
});

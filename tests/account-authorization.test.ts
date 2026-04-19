import { describe, it, expect, afterEach } from "vitest";
import type { TestApp } from "./helpers/setup.js";
import {
  setupAuthedApp,
  createUser,
  createConta,
  associateUser,
} from "./helpers/fixtures.js";
import { requireAccountRole } from "../src/plugins/account-authorization.js";

function registerTestRoutes(app: TestApp["app"]) {
  app.get(
    "/contas/:contaId/owner-only",
    { onRequest: [requireAccountRole({ minRole: "owner" })] },
    async () => ({ ok: true })
  );
  app.get(
    "/contas/:contaId/resource",
    { onRequest: [requireAccountRole({ minRole: "viewer" })] },
    async () => ({ ok: true })
  );
  app.get(
    "/contas/:contaId/viewer-ok",
    { onRequest: [requireAccountRole({ minRole: "viewer" })] },
    async () => ({ ok: true })
  );
}

describe("Account Authorization Middleware", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  async function setup() {
    const authed = await setupAuthedApp(registerTestRoutes);
    testApp = authed.testApp;
    return authed;
  }

  async function injectAs(
    idProvedor: string,
    email: string,
    authed: Awaited<ReturnType<typeof setup>>,
    url: string
  ) {
    const token = await authed.signToken(idProvedor, email);
    return testApp.app.inject({
      method: "GET",
      url,
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it("allows owner to access route requiring owner", async () => {
    const authed = await setup();
    const userId = await createUser(testApp, "owner-user", "owner@example.com");
    const contaId = await createConta(testApp, "Conta Owner");
    await associateUser(testApp, contaId, userId, "owner");

    const res = await injectAs("owner-user", "owner@example.com", authed, `/contas/${contaId}/owner-only`);
    expect(res.statusCode).toBe(200);
  });

  it("blocks viewer from accessing route requiring owner", async () => {
    const authed = await setup();
    const userId = await createUser(testApp, "viewer-user", "viewer@example.com");
    const contaId = await createConta(testApp, "Conta Viewer");
    await associateUser(testApp, contaId, userId, "viewer");

    const res = await injectAs("viewer-user", "viewer@example.com", authed, `/contas/${contaId}/owner-only`);
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("blocks user without association", async () => {
    const authed = await setup();
    await createUser(testApp, "unrelated-user", "unrelated@example.com");
    const contaId = await createConta(testApp, "Conta Privada");

    const res = await injectAs("unrelated-user", "unrelated@example.com", authed, `/contas/${contaId}/resource`);
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for non-existent conta", async () => {
    const authed = await setup();
    await createUser(testApp, "any-user", "any@example.com");

    const res = await injectAs(
      "any-user",
      "any@example.com",
      authed,
      `/contas/00000000-0000-0000-0000-000000000000/resource`
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("allows owner on route requiring viewer", async () => {
    const authed = await setup();
    const userId = await createUser(testApp, "owner2-user", "owner2@example.com");
    const contaId = await createConta(testApp, "Conta Owner2");
    await associateUser(testApp, contaId, userId, "owner");

    const res = await injectAs("owner2-user", "owner2@example.com", authed, `/contas/${contaId}/viewer-ok`);
    expect(res.statusCode).toBe(200);
  });

  it("allows viewer on route requiring viewer", async () => {
    const authed = await setup();
    const userId = await createUser(testApp, "viewer2-user", "viewer2@example.com");
    const contaId = await createConta(testApp, "Conta Viewer2");
    await associateUser(testApp, contaId, userId, "viewer");

    const res = await injectAs("viewer2-user", "viewer2@example.com", authed, `/contas/${contaId}/viewer-ok`);
    expect(res.statusCode).toBe(200);
  });
});

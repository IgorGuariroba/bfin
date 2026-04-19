import { describe, it, expect, afterEach } from "vitest";
import type { TestApp } from "./helpers/setup.js";
import { setupAuthedApp } from "./helpers/fixtures.js";
import { requireAdmin } from "../src/plugins/auth-guard.js";

function withAdminRoute(app: TestApp["app"]) {
  app.get("/admin-only", { onRequest: [requireAdmin()] }, async () => {
    return { ok: true };
  });
}

describe("Admin Guard", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  async function setup(idProvedor: string, email: string, name: string, isAdmin: boolean) {
    const authed = await setupAuthedApp(withAdminRoute);
    testApp = authed.testApp;

    await testApp.client`
      INSERT INTO usuarios (id_provedor, nome, email, is_admin)
      VALUES (${idProvedor}, ${name}, ${email}, ${isAdmin})
    `;

    const token = await authed.signToken(idProvedor, email, name);
    return testApp.app.inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it("allows admin to access protected route", async () => {
    const res = await setup("admin-user", "admin@example.com", "Admin User", true);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.ok).toBe(true);
  });

  it("returns 403 ADMIN_REQUIRED for non-admin user", async () => {
    const res = await setup("regular-user", "regular@example.com", "Regular User", false);
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("ADMIN_REQUIRED");
  });
});

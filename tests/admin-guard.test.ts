import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";
import { requireAdmin } from "../src/plugins/auth-guard.js";

describe("Admin Guard", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  it("allows admin to access protected route", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    // Create admin user directly in the database
    await testApp.client`
      INSERT INTO usuarios (id_provedor, nome, email, is_admin)
      VALUES ('admin-user', 'Admin User', 'admin@example.com', true)
    `;

    const token = await signTestToken(keyPair, {
      sub: "admin-user",
      email: "admin@example.com",
      name: "Admin User",
    });

    testApp.app.get("/admin-only", { onRequest: [requireAdmin()] }, async () => {
      return { ok: true };
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.ok).toBe(true);
  });

  it("returns 403 ADMIN_REQUIRED for non-admin user", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    // Create non-admin user directly in the database
    await testApp.client`
      INSERT INTO usuarios (id_provedor, nome, email, is_admin)
      VALUES ('regular-user', 'Regular User', 'regular@example.com', false)
    `;

    const token = await signTestToken(keyPair, {
      sub: "regular-user",
      email: "regular@example.com",
      name: "Regular User",
    });

    testApp.app.get("/admin-only", { onRequest: [requireAdmin()] }, async () => {
      return { ok: true };
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("ADMIN_REQUIRED");
  });
});

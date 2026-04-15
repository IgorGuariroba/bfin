import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";

describe("User Provisioning", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  it("creates a new user on first access", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    const token = await signTestToken(keyPair, {
      sub: "new-user-123",
      email: "newuser@example.com",
      name: "New User",
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.nome).toBe("New User");
    expect(body.email).toBe("newuser@example.com");

    // Verify user was created in the database
    const users = await testApp.client`
      SELECT * FROM usuarios WHERE id_provedor = ${"new-user-123"}
    `;
    expect(users.length).toBe(1);
    expect(users[0].nome).toBe("New User");
    expect(users[0].is_admin).toBe(false);
  });

  it("reuses existing user on second access", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    const token = await signTestToken(keyPair, {
      sub: "existing-user-456",
      email: "existing@example.com",
      name: "Existing User",
    });

    // First access
    const res1 = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res1.statusCode).toBe(200);

    // Second access
    const res2 = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res2.statusCode).toBe(200);

    // Verify only one user record exists
    const users = await testApp.client`
      SELECT * FROM usuarios WHERE id_provedor = ${"existing-user-456"}
    `;
    expect(users.length).toBe(1);
  });

  it("returns 401 CLAIMS_INSUFFICIENT when token has no email", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    const token = await signTestToken(keyPair, {
      sub: "no-email-user",
      name: "No Email User",
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("CLAIMS_INSUFFICIENT");
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";

describe("GET /me", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  it("returns 200 with user data when authenticated", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    const token = await signTestToken(keyPair, {
      sub: "me-user-123",
      email: "me@example.com",
      name: "Me User",
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toMatchObject({
      nome: "Me User",
      email: "me@example.com",
      isAdmin: false,
    });
    expect(body.id).toBeDefined();
  });

  it("returns 401 when no token is provided", async () => {
    testApp = await createTestApp({
      validateToken: async () => {
        throw new Error("Should not be called");
      },
    });

    const res = await testApp.app.inject({ method: "GET", url: "/me" });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("AUTH_REQUIRED");
  });
});

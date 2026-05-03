import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp } from "./helpers/setup.js";
import type { TestApp } from "./helpers/setup.js";
import {
  generateTestKeyPair,
  createTestJwksProvider,
  signTestToken,
} from "./helpers/auth.js";
import { TokenValidationError } from "../src/plugins/oidc.js";
import { errors as joseErrors } from "jose";

describe("Auth Guard", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.teardown();
  });

  it("returns 401 AUTH_REQUIRED when no token is provided", async () => {
    testApp = await createTestApp({
      validateToken: async () => {
        throw new TokenValidationError("Token invalid", "TOKEN_INVALID");
      },
    });
    const res = await testApp.app.inject({ method: "GET", url: "/me" });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns 401 AUTH_REQUIRED when Authorization header is not Bearer", async () => {
    testApp = await createTestApp({
      validateToken: async () => {
        throw new TokenValidationError("Token invalid", "TOKEN_INVALID");
      },
    });
    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: "Basic abc123" },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns 401 AUTH_REQUIRED when Bearer token is empty", async () => {
    testApp = await createTestApp({
      validateToken: async () => {
        throw new TokenValidationError("Token invalid", "TOKEN_INVALID");
      },
    });
    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: "Bearer " },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns 401 TOKEN_INVALID for an invalid token", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: "Bearer invalid-token" },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("TOKEN_INVALID");
  });

  it("returns 401 TOKEN_EXPIRED for an expired token", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });

    const token = await signTestToken(keyPair, {
      sub: "user-123",
      email: "user@example.com",
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("TOKEN_EXPIRED");
  });

  it("allows request with a valid token", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    const token = await signTestToken(keyPair, {
      sub: "user-123",
      email: "user@example.com",
      name: "Test User",
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("allows public route /health without token (redirects)", async () => {
    testApp = await createTestApp({
      validateToken: async () => {
        throw new TokenValidationError("Token invalid", "TOKEN_INVALID");
      },
    });
    const res = await testApp.app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(302);
    expect(res.headers["location"]).toBe("/health/live");
  });

  it("allows public route /health/live without token", async () => {
    testApp = await createTestApp({
      validateToken: async () => {
        throw new TokenValidationError("Token invalid", "TOKEN_INVALID");
      },
    });
    const res = await testApp.app.inject({ method: "GET", url: "/health/live" });
    expect(res.statusCode).toBe(200);
  });

  it("allows public route /.well-known/openid-configuration without token", async () => {
    testApp = await createTestApp({
      validateToken: async () => {
        throw new TokenValidationError("Token invalid", "TOKEN_INVALID");
      },
    });
    const res = await testApp.app.inject({ method: "GET", url: "/.well-known/openid-configuration" });
    expect(res.statusCode).toBe(404);
  });

  it("allows public route /mcp without token", async () => {
    testApp = await createTestApp({
      validateToken: async () => {
        throw new TokenValidationError("Token invalid", "TOKEN_INVALID");
      },
    });
    const res = await testApp.app.inject({ method: "GET", url: "/mcp" });
    expect(res.statusCode).toBe(404);
  });

  it("returns 401 TOKEN_INVALID when audience does not match", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    const token = await signTestToken(keyPair, {
      sub: "user-123",
      email: "user@example.com",
      aud: "wrong-audience",
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("TOKEN_INVALID");
  });

  it("allows request when audience is array containing expected audience", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    const token = await signTestToken(keyPair, {
      sub: "user-123",
      email: "user@example.com",
      aud: ["https://api.bfincont.com.br", "other-audience"],
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 401 TOKEN_INVALID for JWSSignatureVerificationFailed", async () => {
    testApp = await createTestApp({
      validateToken: async () => {
        throw new joseErrors.JWSSignatureVerificationFailed("bad sig");
      },
    });
    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: "Bearer token" },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("TOKEN_INVALID");
  });

  it("returns 401 TOKEN_INVALID for JWTClaimValidationFailed", async () => {
    testApp = await createTestApp({
      validateToken: async () => {
        throw new joseErrors.JWTClaimValidationFailed("bad claim");
      },
    });
    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: "Bearer token" },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("TOKEN_INVALID");
  });

  it("returns 401 TOKEN_INVALID for JWKSNoMatchingKey", async () => {
    testApp = await createTestApp({
      validateToken: async () => {
        throw new joseErrors.JWKSNoMatchingKey();
      },
    });
    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: "Bearer token" },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("TOKEN_INVALID");
  });

  it("returns 401 EMAIL_NOT_VERIFIED when relinking with unverified email", async () => {
    const keyPair = await generateTestKeyPair();
    const validateToken = await createTestJwksProvider(keyPair);
    testApp = await createTestApp({ validateToken });
    await testApp.truncateAll();

    await testApp.client`
      INSERT INTO usuarios (id_provedor, nome, email, is_admin)
      VALUES (${"existing-provider"}, ${"Existing"}, ${"user@example.com"}, ${false})
    `;

    const token = await signTestToken(keyPair, {
      sub: "new-provider",
      email: "user@example.com",
      email_verified: false,
    });

    const res = await testApp.app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("EMAIL_NOT_VERIFIED");
  });
});

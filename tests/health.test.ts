import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest";
import { createTestApp, type TestApp } from "./helpers/setup.js";

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp({
    validateToken: async () => {
      throw new Error("Should not be called");
    },
  });
});

afterAll(async () => {
  await testApp.teardown();
});

afterEach(async () => {
  await testApp.truncateAll();
});

describe("GET /health/live", () => {
  it("returns status ok", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/health/live",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});

describe("GET /health/ready", () => {
  it("returns ready when db is up", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/health/ready",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ready" });
  });
});

describe("GET /health", () => {
  it("redirects to /health/live with deprecation header", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers["deprecation"]).toBe("true");
    expect(response.headers["location"]).toBe("/health/live");
  });
});

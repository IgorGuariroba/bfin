import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
import { createTestApp, type TestApp } from "./helpers/setup.js";

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();
});

afterAll(async () => {
  await testApp.teardown();
});

beforeEach(async () => {
  await testApp.beginTransaction();
});

afterEach(async () => {
  await testApp.rollbackTransaction();
});

describe("GET /health", () => {
  it("returns status ok", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});

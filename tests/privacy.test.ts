import { describe, beforeAll, afterAll, it, expect } from "vitest";
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

describe("GET /privacy", () => {
  it("returns 200 with HTML body", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/privacy",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
    expect(response.body).toContain("<!DOCTYPE html>");
    expect(response.body).toContain("Política de Privacidade");
  });

  it("renders GFM tables and bold from markdown", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/privacy",
    });

    expect(response.body).toContain("<table>");
    expect(response.body).toContain("<th>");
    expect(response.body).toContain("<td>");
    expect(response.body).toContain("<strong>");
  });
});

describe("GET /privacy/v1", () => {
  it("redirects to /privacy", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/privacy/v1",
    });

    expect([301, 302, 307]).toContain(response.statusCode);
    expect(response.headers["location"]).toBe("/privacy");
  });
});

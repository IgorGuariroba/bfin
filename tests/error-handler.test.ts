import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest";
import { createTestApp, type TestApp } from "./helpers/setup.js";
import {
  BusinessRuleError,
  NotFoundError,
} from "../src/lib/errors.js";

type ErrorBody = {
  timestamp: string;
  requestId: string;
  message: string;
  code: string;
};

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp(
    {
      validateToken: async () => ({
        sub: "test-user",
        email: "test@example.com",
        name: "Test User",
      }),
    },
    (app) => {
      app.get("/test-business-error", async () => {
        throw new BusinessRuleError("Valor deve ser positivo");
      });
      app.get("/test-not-found", async () => {
        throw new NotFoundError("Recurso não encontrado");
      });
      app.get("/test-unexpected", async () => {
        throw new TypeError("Algo quebrou internamente");
      });
      app.get("/test-request-id", async () => {
        throw new BusinessRuleError("Erro de teste");
      });
    }
  );
});

afterAll(async () => {
  await testApp.teardown();
});

afterEach(async () => {
  await testApp.truncateAll();
});

describe("Error handler", () => {
  it("returns 422 for BusinessRuleError", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/test-business-error",
      headers: { authorization: "Bearer dummy" },
    });

    expect(response.statusCode).toBe(422);
    const body = response.json<ErrorBody>();
    expect(body.message).toBe("Valor deve ser positivo");
    expect(body.code).toBe("BUSINESS_RULE_VIOLATION");
    expect(body.requestId).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it("returns 404 for NotFoundError", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/test-not-found",
      headers: { authorization: "Bearer dummy" },
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<ErrorBody>();
    expect(body.message).toBe("Recurso não encontrado");
    expect(body.code).toBe("RESOURCE_NOT_FOUND");
    expect(body.requestId).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it("returns 500 for unexpected errors without exposing details", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/test-unexpected",
      headers: { authorization: "Bearer dummy" },
    });

    expect(response.statusCode).toBe(500);
    const body = response.json<ErrorBody>();
    expect(body.message).toBe("Internal server error");
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.requestId).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it("includes requestId in error response", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/test-request-id",
      headers: {
        "X-Request-Id": "custom-req-id-123",
        authorization: "Bearer dummy",
      },
    });

    const body = response.json<ErrorBody>();
    expect(body.requestId).toBe("custom-req-id-123");
  });
});

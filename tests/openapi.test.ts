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

describe("GET /openapi.json", () => {
  it("returns OpenAPI spec with expected paths", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/openapi.json",
    });

    expect(response.statusCode).toBe(200);
    const spec = response.json();

    expect(spec.openapi).toMatch(/^3\.\d+\.\d+$/);
    expect(spec.info.title).toBe("bfin API");

    const paths = Object.keys(spec.paths).sort();
    const expectedPaths = [
      "/contas",
      "/contas/{contaId}",
      "/contas/{contaId}/limite-diario",
      "/contas/{contaId}/limite-diario-v2",
      "/contas/{contaId}/usuarios",
      "/categorias",
      "/categorias/{categoriaId}",
      "/dividas",
      "/dividas/{dividaId}",
      "/dividas/{dividaId}/parcelas/{parcelaId}/pagamento",
      "/health/live",
      "/health/ready",
      "/me",
      "/metas",
      "/movimentacoes",
      "/movimentacoes/{movimentacaoId}",
      "/privacy",
      "/privacy/v1",
      "/projecao",
    ];

    for (const path of expectedPaths) {
      expect(paths).toContain(path);
    }
  });

  it("includes ApiError component schema", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/openapi.json",
    });

    const spec = response.json();
    expect(spec.components?.schemas?.ApiError).toBeDefined();
    expect(spec.components.schemas.ApiError.properties).toHaveProperty("code");
    expect(spec.components.schemas.ApiError.properties).toHaveProperty("message");
    expect(spec.components.schemas.ApiError.properties).toHaveProperty("timestamp");
    expect(spec.components.schemas.ApiError.properties).toHaveProperty("requestId");
  });
});

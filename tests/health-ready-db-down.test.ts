import { describe, beforeAll, afterAll, it, expect, vi } from "vitest";
import { fastify } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { healthRoutes } from "../src/routes/health.js";

vi.mock("../src/db/index.js", () => ({
  client: Object.assign(
    vi.fn().mockRejectedValue(new Error("connection refused")),
    { end: vi.fn() }
  ),
  db: {},
}));

describe("GET /health/ready with db down", () => {
  it("returns not ready", async () => {
    const app = fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(healthRoutes);
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/health/ready",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "not ready" });

    await app.close();
  });
});

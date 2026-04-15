import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest";
import { createTestApp, type TestApp } from "./helpers/setup.js";
import { fastify } from "fastify";
import pino from "pino";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { registerErrorHandler } from "../src/lib/error-handler.js";

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();
  await testApp.app.ready();
});

afterAll(async () => {
  await testApp.teardown();
});

afterEach(async () => {
  await testApp.truncateAll();
});

async function createApp(options: {
  corsOrigin?: string;
  rateLimitMax?: number;
  rateLimitWindow?: number;
  loggerInstance?: ReturnType<typeof pino>;
} = {}) {
  const app = fastify({
    logger: options.loggerInstance ? undefined : { level: "silent" },
    loggerInstance: options.loggerInstance,
    bodyLimit: 1_048_576,
    connectionTimeout: 10_000,
    keepAliveTimeout: 5_000,
  });

  registerErrorHandler(app);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: options.corsOrigin ?? false,
  });
  await app.register(rateLimit, {
    max: options.rateLimitMax ?? 100,
    timeWindow: options.rateLimitWindow ?? 60_000,
    global: true,
    keyGenerator: () => "test-client",
  });

  app.get("/test", async () => {
    return { ok: true };
  });

  return app;
}

describe("CORS", () => {
  it("allows requests from configured origin", async () => {
    const app = await createApp({ corsOrigin: "https://example.com" });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/test",
      headers: {
        origin: "https://example.com",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("https://example.com");
    await app.close();
  });

  it("denies requests from disallowed origin", async () => {
    const app = await createApp({ corsOrigin: "https://example.com" });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/test",
      headers: {
        origin: "https://evil.com",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).not.toBe("https://evil.com");
    await app.close();
  });
});

describe("Rate limit", () => {
  it("returns 429 with Retry-After after exceeding limit", async () => {
    const app = await createApp({ rateLimitMax: 2, rateLimitWindow: 60_000 });
    await app.ready();

    await app.inject({ method: "GET", url: "/test" });
    await app.inject({ method: "GET", url: "/test" });

    const response = await app.inject({ method: "GET", url: "/test" });
    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBeDefined();

    await app.close();
  });
});

describe("Body size limit", () => {
  it("returns 413 for a 2 MB POST body", async () => {
    const app = await createApp();
    app.post("/test-body-limit", async () => {
      return { ok: true };
    });
    await app.ready();

    const bigBody = "x".repeat(2 * 1024 * 1024);
    const response = await app.inject({
      method: "POST",
      url: "/test-body-limit",
      headers: {
        "content-type": "text/plain",
      },
      payload: bigBody,
    });

    expect(response.statusCode).toBe(413);
    await app.close();
  });
});

describe("Log redaction", () => {
  it("redacts Authorization header in logs", async () => {
    const logs: string[] = [];
    const stream = {
      write: (line: string) => {
        logs.push(line);
      },
    };

    const app = await createApp({
      loggerInstance: pino(
        {
          level: "info",
          redact: {
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              "req.headers['set-cookie']",
              "req.headers.password",
              "req.headers.token",
              "password",
              "token",
              "authorization",
              "cookie",
            ],
            censor: "[Redacted]",
          },
        },
        stream
      ),
    });
    await app.ready();

    app.log.info({ authorization: "Bearer secret-token" }, "test log");

    const allLogs = logs.join("\n");
    expect(allLogs).not.toContain("secret-token");
    expect(allLogs).toContain("[Redacted]");

    await app.close();
  });
});

describe("Metrics", () => {
  it("returns 200 and contains expected metric families", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/metrics",
    });

    expect(response.statusCode).toBe(200);
    const body = response.payload;
    expect(body).toContain("http_request_duration_seconds");
    expect(body).toContain("# TYPE");
  });
});

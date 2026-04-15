import { FastifyInstance, FastifyPluginCallback, fastify } from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import metricsPlugin from "fastify-metrics";

type MetricsPluginOptions = { endpoint?: string };
const metrics = metricsPlugin as unknown as FastifyPluginCallback<MetricsPluginOptions>;
import { healthRoutes } from "./routes/health.js";
import { generateRequestId } from "./plugins/request-id.js";
import { registerErrorHandler } from "./lib/error-handler.js";
import { config } from "./config.js";

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: {
      level: config.logLevel,
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
    bodyLimit: 1_048_576,
    connectionTimeout: 10_000,
    keepAliveTimeout: 5_000,
    genReqId(req) {
      const existing = req.headers["x-request-id"];
      if (existing) {
        return String(existing);
      }
      return generateRequestId();
    },
  });

  registerErrorHandler(app);

  void app.register(helmet, { contentSecurityPolicy: false });
  void app.register(cors, {
    origin: config.corsOrigin ?? false,
  });
  void app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindow,
    global: true,
  });

  const metricsEnabled =
    config.nodeEnv !== "production" || Boolean(config.metricsToken);

  if (metricsEnabled) {
    app.addHook("onRequest", async (req, reply) => {
      if (!req.url.startsWith("/metrics")) return;
      if (!config.metricsToken) return;
      const expected = `Bearer ${config.metricsToken}`;
      if (req.headers.authorization !== expected) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    });
    void app.register(metrics, { endpoint: "/metrics" });
  } else {
    app.log.warn("Metrics endpoint disabled: set METRICS_TOKEN to enable in production");
  }

  void app.register(healthRoutes);

  return app;
}

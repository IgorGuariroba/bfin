import { FastifyInstance, FastifyPluginCallback, fastify } from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import metricsPlugin from "fastify-metrics";

type MetricsPluginOptions = { endpoint?: string };
const metrics = metricsPlugin as unknown as FastifyPluginCallback<MetricsPluginOptions>;
import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";
import { categoryRoutes } from "./routes/categories.js";
import { accountRoutes } from "./routes/accounts.js";
import { accountMemberRoutes } from "./routes/account-members.js";
import { transactionRoutes } from "./routes/transactions.js";
import { debtRoutes } from "./routes/debts.js";
import { projectionRoutes } from "./routes/projections.js";
import { goalRoutes } from "./routes/goals.js";
import { generateRequestId } from "./plugins/request-id.js";
import { registerErrorHandler } from "./lib/error-handler.js";
import { authGuard, AuthGuardOptions } from "./plugins/auth-guard.js";
import { registerProjectionListener } from "./services/projection-engine/index.js";
import { config } from "./config.js";

export interface BuildAppOptions {
  authGuardOptions?: AuthGuardOptions;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
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

  void app.register(authGuard, options.authGuardOptions ?? {});
  void app.register(healthRoutes);
  void app.register(meRoutes);
  void app.register(categoryRoutes);
  void app.register(accountRoutes);
  void app.register(accountMemberRoutes);
  void app.register(transactionRoutes);
  void app.register(debtRoutes);
  void app.register(projectionRoutes);
  void app.register(goalRoutes);

  registerProjectionListener({ logger: app.log });

  return app;
}

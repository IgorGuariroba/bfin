import { FastifyInstance, fastify } from "fastify";
import { healthRoutes } from "./routes/health.js";
import { generateRequestId } from "./plugins/request-id.js";
import { registerErrorHandler } from "./lib/error-handler.js";

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: true,
    genReqId(req) {
      const existing = req.headers["x-request-id"];
      if (existing) {
        return String(existing);
      }
      return generateRequestId();
    },
  });

  registerErrorHandler(app);
  void app.register(healthRoutes);

  return app;
}

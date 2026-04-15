import { FastifyInstance } from "fastify";
import { client } from "../db/index.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health/live", async (_, reply) => {
    void reply.status(200);
    return { status: "ok" };
  });

  app.get("/health/ready", async (_, reply) => {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Database health check timed out")), 2000)
      );
      await Promise.race([client`SELECT 1`, timeout]);
      void reply.status(200);
      return { status: "ready" };
    } catch {
      void reply.status(503);
      return { status: "not ready" };
    }
  });

  app.get("/health", async (request, reply) => {
    void reply.header("Deprecation", "true");
    return reply.redirect("/health/live");
  });
}

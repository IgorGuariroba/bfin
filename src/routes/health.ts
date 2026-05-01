import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { client } from "../db/index.js";
import { loadHttpMcpConfig } from "../config.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/health/live",
    {
      schema: {
        response: {
          200: z.object({ status: z.string() }),
        },
      },
    },
    async (_, reply) => {
      void reply.status(200);
      return { status: "ok" as const };
    }
  );

  typedApp.get(
    "/health/ready",
    {
      schema: {
        response: {
          200: z.object({
            status: z.string(),
            services: z.object({
              database: z.string(),
              mcp: z.string(),
            }),
          }),
          503: z.object({ status: z.string() }),
        },
      },
    },
    async (_, reply) => {
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Database health check timed out")), 2000)
        );
        await Promise.race([client`SELECT 1`, timeout]);

        const mcpConfig = loadHttpMcpConfig();
        const mcpStatus = mcpConfig.enabled ? "enabled" as const : "disabled" as const;

        void reply.status(200);
        return {
          status: "ready" as const,
          services: {
            database: "ok" as const,
            mcp: mcpStatus,
          },
        };
      } catch {
        void reply.status(503);
        return { status: "not ready" as const };
      }
    }
  );

  typedApp.get(
    "/health",
    {
      schema: {
        hide: true,
      },
    },
    async (request, reply) => {
      void reply.header("Deprecation", "true");
      return reply.redirect("/health/live");
    }
  );
}

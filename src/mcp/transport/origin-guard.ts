import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import type { Logger } from "pino";

export interface OriginGuardOptions {
  allowedOrigins: ReadonlySet<string>;
  nodeEnv: string;
  logger: Logger;
}

export function buildOriginGuard(options: OriginGuardOptions) {
  const { allowedOrigins, nodeEnv, logger } = options;

  return function originGuard(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ): void {
    const origin = request.headers.origin;

    if (!origin) {
      if (nodeEnv === "production") {
        logger.warn(
          { path: request.url, ip: request.ip },
          "MCP Origin rejected: missing header in production"
        );
        reply.code(403).send({ error: "forbidden_origin" });
        return;
      }
      done();
      return;
    }

    if (allowedOrigins.has(origin)) {
      done();
      return;
    }

    logger.warn(
      { origin, path: request.url, ip: request.ip },
      "MCP Origin rejected: not in allowlist"
    );
    reply.code(403).send({ error: "forbidden_origin" });
  };
}

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import type { Logger } from "pino";

export interface OriginGuardOptions {
  allowedOrigins: ReadonlySet<string>;
  logger: Logger;
}

export function buildOriginGuard(options: OriginGuardOptions) {
  const { allowedOrigins, logger } = options;

  return function originGuard(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ): void {
    const origin = request.headers.origin;

    if (!origin) {
      // Non-browser clients (server-to-server MCP, CLI tools) don't send
      // an Origin header. DNS rebinding only applies to browser requests,
      // so absent Origin is safe to allow through.
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

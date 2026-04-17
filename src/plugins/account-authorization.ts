import { FastifyRequest, FastifyReply } from "fastify";
import {
  assertAccountRole,
  type AccountRole,
} from "../lib/account-authorization.js";
import { uuidSchema } from "../lib/validation.js";

export type { AccountRole } from "../lib/account-authorization.js";

export interface RequireAccountRoleOptions {
  minRole: AccountRole;
  extractContaId?: (request: FastifyRequest) => string | undefined;
}

export function requireAccountRole(options: RequireAccountRoleOptions) {
  const { minRole, extractContaId } = options;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.status(403).send({
        timestamp: new Date().toISOString(),
        requestId: request.id,
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    let contaId: string | undefined;
    if (extractContaId) {
      contaId = extractContaId(request);
    } else {
      contaId = (request.params as { contaId?: string })?.contaId;
      if (!contaId && request.body && typeof request.body === "object") {
        contaId = (request.body as { contaId?: string }).contaId;
      }
    }

    if (!contaId) {
      return reply.status(422).send({
        timestamp: new Date().toISOString(),
        requestId: request.id,
        message: "contaId is required",
        code: "VALIDATION_ERROR",
      });
    }

    if (!uuidSchema.safeParse(contaId).success) {
      return reply.status(422).send({
        timestamp: new Date().toISOString(),
        requestId: request.id,
        message: "contaId must be a valid UUID",
        code: "VALIDATION_ERROR",
      });
    }

    await assertAccountRole(user.id, contaId, minRole);
  };
}

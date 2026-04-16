import { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { contas, contaUsuarios } from "../db/schema.js";
import { NotFoundError, ForbiddenError } from "../lib/errors.js";
import { uuidSchema } from "../lib/validation.js";

export type AccountRole = "owner" | "viewer";

function roleSufficient(userRole: AccountRole, requiredRole: AccountRole): boolean {
  if (requiredRole === "viewer") return true;
  return userRole === "owner";
}

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

    const conta = await db.query.contas.findFirst({
      where: eq(contas.id, contaId),
    });

    if (!conta) {
      throw new NotFoundError("Conta not found");
    }

    const association = await db.query.contaUsuarios.findFirst({
      where: and(eq(contaUsuarios.contaId, contaId), eq(contaUsuarios.usuarioId, user.id)),
    });

    if (!association) {
      throw new ForbiddenError("You do not have access to this account");
    }

    if (!roleSufficient(association.papel, minRole)) {
      throw new ForbiddenError("Insufficient permissions for this account");
    }
  };
}

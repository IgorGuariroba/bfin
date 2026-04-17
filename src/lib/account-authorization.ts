import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { contas, contaUsuarios } from "../db/schema.js";
import { NotFoundError, ForbiddenError } from "./errors.js";

export type AccountRole = "owner" | "viewer";

export function roleSufficient(
  userRole: AccountRole,
  requiredRole: AccountRole
): boolean {
  if (requiredRole === "viewer") return true;
  return userRole === "owner";
}

export async function assertAccountRole(
  userId: string,
  contaId: string,
  minRole: AccountRole
): Promise<void> {
  const conta = await db.query.contas.findFirst({
    where: eq(contas.id, contaId),
  });

  if (!conta) {
    throw new NotFoundError("Conta not found");
  }

  const association = await db.query.contaUsuarios.findFirst({
    where: and(
      eq(contaUsuarios.contaId, contaId),
      eq(contaUsuarios.usuarioId, userId)
    ),
  });

  if (!association) {
    throw new ForbiddenError("You do not have access to this account");
  }

  if (!roleSufficient(association.papel, minRole)) {
    throw new ForbiddenError("Insufficient permissions for this account");
  }
}

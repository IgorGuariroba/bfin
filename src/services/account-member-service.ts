import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { usuarios, contaUsuarios } from "../db/schema.js";
import { NotFoundError, DuplicateError, BusinessRuleError, isDuplicateKeyError } from "../lib/errors.js";
import { config } from "../config.js";

export interface AddMemberInput {
  contaId: string;
  email: string;
  papel: "owner" | "viewer";
}

export async function addMember(input: AddMemberInput) {
  if (input.contaId === config.demoAccountId) {
    throw new BusinessRuleError(`Cannot link a real user to the demo account (${config.demoAccountId})`);
  }

  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, input.email),
  });

  if (!usuario) {
    throw new NotFoundError("User not found");
  }

  try {
    await db.insert(contaUsuarios).values({
      contaId: input.contaId,
      usuarioId: usuario.id,
      papel: input.papel,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new DuplicateError("User is already associated with this account");
    }
    throw err;
  }

  return {
    usuarioId: usuario.id,
    email: usuario.email,
    papel: input.papel,
  };
}

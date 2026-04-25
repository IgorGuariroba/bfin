import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { usuarios } from "../db/schema.js";
import { config } from "../config.js";
import type { OidcClaims } from "../plugins/oidc.js";

export interface AuthUser {
  id: string;
  idProvedor: string;
  nome: string;
  email: string;
  isAdmin: boolean;
}

export class UserCreationError extends Error {
  constructor(
    message: string,
    public readonly code: "CLAIMS_INSUFFICIENT" | "EMAIL_CONFLICT"
  ) {
    super(message);
    this.name = "UserCreationError";
  }
}

export async function findOrCreateUser(claims: OidcClaims): Promise<AuthUser> {
  if (!claims.email) {
    throw new UserCreationError("Token missing required claim: email", "CLAIMS_INSUFFICIENT");
  }

  const nome =
    claims.name ??
    (claims.given_name && claims.family_name
      ? `${claims.given_name} ${claims.family_name}`
      : claims.given_name ?? "Unknown");

  const existing = await db.query.usuarios.findFirst({
    where: eq(usuarios.idProvedor, claims.sub),
  });

  if (existing) {
    const shouldBeAdmin = config.adminEmails.has(existing.email.toLowerCase());
    if (shouldBeAdmin && !existing.isAdmin) {
      await db.update(usuarios).set({ isAdmin: true }).where(eq(usuarios.id, existing.id));
      return { id: existing.id, idProvedor: existing.idProvedor, nome: existing.nome, email: existing.email, isAdmin: true };
    }
    return { id: existing.id, idProvedor: existing.idProvedor, nome: existing.nome, email: existing.email, isAdmin: existing.isAdmin };
  }

  try {
    const [created] = await db
      .insert(usuarios)
      .values({
        idProvedor: claims.sub,
        nome,
        email: claims.email,
        isAdmin: config.adminEmails.has(claims.email.toLowerCase()),
      })
      .returning();

    return {
      id: created.id,
      idProvedor: created.idProvedor,
      nome: created.nome,
      email: created.email,
      isAdmin: created.isAdmin,
    };
  } catch (err) {
    const error = err as { code?: string; message?: string };
    if (error.code === "23505" && error.message?.includes("usuarios_email_unique")) {
      throw new UserCreationError(
        "Email already registered with another provider",
        "EMAIL_CONFLICT"
      );
    }
    throw err;
  }
}

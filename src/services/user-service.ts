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
    public readonly code: "CLAIMS_INSUFFICIENT" | "EMAIL_CONFLICT" | "EMAIL_NOT_VERIFIED"
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

  const existingByProvedor = await db.query.usuarios.findFirst({
    where: eq(usuarios.idProvedor, claims.sub),
  });

  if (existingByProvedor) {
    const shouldBeAdmin = config.adminEmails.has(existingByProvedor.email.toLowerCase());
    if (shouldBeAdmin && !existingByProvedor.isAdmin) {
      await db.update(usuarios).set({ isAdmin: true }).where(eq(usuarios.id, existingByProvedor.id));
      return { id: existingByProvedor.id, idProvedor: existingByProvedor.idProvedor, nome: existingByProvedor.nome, email: existingByProvedor.email, isAdmin: true };
    }
    return { id: existingByProvedor.id, idProvedor: existingByProvedor.idProvedor, nome: existingByProvedor.nome, email: existingByProvedor.email, isAdmin: existingByProvedor.isAdmin };
  }

  const existingByEmail = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, claims.email),
  });

  if (existingByEmail) {
    if (claims.email_verified !== true) {
      throw new UserCreationError("Email not verified; cannot re-link account", "EMAIL_NOT_VERIFIED");
    }
    await db.update(usuarios).set({ idProvedor: claims.sub }).where(eq(usuarios.id, existingByEmail.id));
    const shouldBeAdmin = config.adminEmails.has(existingByEmail.email.toLowerCase());
    if (shouldBeAdmin && !existingByEmail.isAdmin) {
      await db.update(usuarios).set({ isAdmin: true }).where(eq(usuarios.id, existingByEmail.id));
    }
    return {
      id: existingByEmail.id,
      idProvedor: claims.sub,
      nome: existingByEmail.nome,
      email: existingByEmail.email,
      isAdmin: shouldBeAdmin || existingByEmail.isAdmin,
    };
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

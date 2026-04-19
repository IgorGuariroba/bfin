import { eq } from "drizzle-orm";
import type { Logger } from "pino";
import { db } from "../../db/index.js";
import { usuarios } from "../../db/schema.js";
import { ServiceAccountBootstrapError } from "../identity.js";
import { isDuplicateKeyError } from "../../lib/errors.js";
import type { McpClaims } from "../../lib/oidc-mcp.js";

export interface ProvisioningOptions {
  allowlistRaw: string | undefined;
  logger: Logger;
}

function parseAllowlist(raw: string | undefined): {
  exact: Set<string>;
  regexes: RegExp[];
} {
  const exact = new Set<string>();
  const regexes: RegExp[] = [];
  if (!raw) return { exact, regexes };
  for (const item of raw.split(",")) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("/") && trimmed.lastIndexOf("/") > 0) {
      const last = trimmed.lastIndexOf("/");
      const pattern = trimmed.slice(1, last);
      const flags = trimmed.slice(last + 1);
      try {
        regexes.push(new RegExp(pattern, flags));
      } catch {
        // ignore invalid regex entries
      }
      continue;
    }
    exact.add(trimmed.toLowerCase());
  }
  return { exact, regexes };
}

export function isEmailAllowed(
  email: string | undefined,
  allowlistRaw: string | undefined
): boolean {
  if (!email || !allowlistRaw) return false;
  const lowered = email.toLowerCase();
  const { exact, regexes } = parseAllowlist(allowlistRaw);
  if (exact.has(lowered)) return true;
  return regexes.some((re) => re.test(email));
}

export async function resolveUserFromClaims(
  claims: McpClaims,
  opts: ProvisioningOptions
): Promise<string> {
  const existing = await db.query.usuarios.findFirst({
    where: eq(usuarios.idProvedor, claims.sub),
  });
  if (existing) return existing.id;

  if (!isEmailAllowed(claims.email, opts.allowlistRaw)) {
    throw new ServiceAccountBootstrapError(
      `No user mapped to sub='${claims.sub}' and email not in allowlist`,
      "USER_NOT_FOUND"
    );
  }

  const nome = claims.name?.trim() || claims.email?.split("@")[0] || claims.sub;
  const email = claims.email!;

  try {
    const [inserted] = await db
      .insert(usuarios)
      .values({
        idProvedor: claims.sub,
        nome,
        email,
      })
      .returning({ id: usuarios.id });

    opts.logger.info(
      { sub: claims.sub, email, user_id: inserted.id },
      "provisioned new user from OAuth claims"
    );

    return inserted.id;
  } catch (err) {
    // Concurrent first-login for the same sub: another request won the race.
    // Re-read and return the row it inserted.
    if (isDuplicateKeyError(err)) {
      const winner = await db.query.usuarios.findFirst({
        where: eq(usuarios.idProvedor, claims.sub),
      });
      if (winner) return winner.id;
    }
    throw err;
  }
}

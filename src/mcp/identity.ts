import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { usuarios } from "../db/schema.js";
import { config, loadMcpConfig, type McpConfig } from "../config.js";
import {
  createJwtVerifier,
  JwtValidationError,
  type JwtVerifier,
} from "../lib/oidc-jwks.js";
import { mcpLogger } from "./logger.js";

export class ServiceAccountBootstrapError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "TOKEN_EXPIRED"
      | "TOKEN_INVALID"
      | "SUBJECT_MISSING"
      | "USER_NOT_FOUND"
  ) {
    super(message);
    this.name = "ServiceAccountBootstrapError";
  }
}

export interface ServiceAccount {
  readonly subject: string;
  readonly scopes: ReadonlySet<string>;
  readonly actingUserId: string;
  readonly tokenExp: number | undefined;
}

function extractScopeClaim(payload: { scope?: unknown; scp?: unknown }): string {
  if (typeof payload.scope === "string") return payload.scope;
  const scp = payload.scp;
  if (typeof scp === "string") return scp;
  if (Array.isArray(scp)) return scp.map(String).join(" ");
  return "";
}

export function parseScopes(raw: unknown): Set<string> {
  const scopes = new Set<string>();
  if (typeof raw !== "string") return scopes;

  for (const item of raw.split(/\s+/)) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (!trimmed.includes(":")) {
      mcpLogger.warn({ scope: trimmed }, "discarding malformed scope (missing ':')");
      continue;
    }
    scopes.add(trimmed);
  }

  return scopes;
}

export async function loadServiceAccount(params?: {
  mcpConfig?: McpConfig;
  verifier?: JwtVerifier;
}): Promise<ServiceAccount> {
  const mcpConfig = params?.mcpConfig ?? loadMcpConfig();

  const verifier =
    params?.verifier ??
    (await createJwtVerifier({
      issuerUrl: config.oidcIssuerUrl,
      audience: mcpConfig.oidcAudience,
    }));

  let payload;
  try {
    payload = await verifier.verify(mcpConfig.serviceAccountToken);
  } catch (err) {
    if (err instanceof JwtValidationError) {
      throw new ServiceAccountBootstrapError(
        err.code === "TOKEN_EXPIRED"
          ? "MCP service account token expired"
          : "MCP service account token invalid",
        err.code
      );
    }
    throw err;
  }

  const subject = payload.sub;
  if (!subject) {
    throw new ServiceAccountBootstrapError(
      "MCP service account token missing 'sub' claim",
      "SUBJECT_MISSING"
    );
  }

  const rawScope = extractScopeClaim(payload as { scope?: unknown; scp?: unknown });

  const scopes = parseScopes(rawScope);

  const actingUser = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, mcpConfig.subjectUserId),
  });

  if (!actingUser) {
    throw new ServiceAccountBootstrapError(
      `MCP_SUBJECT_USER_ID=${mcpConfig.subjectUserId} does not match any user`,
      "USER_NOT_FOUND"
    );
  }

  return Object.freeze({
    subject,
    scopes: scopes as ReadonlySet<string>,
    actingUserId: actingUser.id,
    tokenExp: typeof payload.exp === "number" ? payload.exp : undefined,
  });
}

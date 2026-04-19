import type { Logger } from "pino";
import {
  JwtValidationError,
  type McpClaims,
  type McpJwtVerifier,
} from "../lib/oidc-mcp.js";
import { mcpLogger } from "./logger.js";
import { resolveUserFromClaims } from "./oauth/provisioning.js";

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

export interface LoadServiceAccountFromTokenParams {
  token: string;
  verifier: McpJwtVerifier;
  provisioning: {
    allowlistRaw: string | undefined;
    logger?: Logger;
  };
}

export async function loadServiceAccountFromToken(
  params: LoadServiceAccountFromTokenParams
): Promise<ServiceAccount> {
  let claims: McpClaims;
  try {
    claims = await params.verifier.verify(params.token);
  } catch (err) {
    if (err instanceof JwtValidationError) {
      throw new ServiceAccountBootstrapError(
        err.code === "TOKEN_EXPIRED" ? "Token expired" : "Token invalid",
        err.code
      );
    }
    throw err;
  }

  if (!claims.sub) {
    throw new ServiceAccountBootstrapError(
      "Token missing 'sub' claim",
      "SUBJECT_MISSING"
    );
  }

  const actingUserId = await resolveUserFromClaims(claims, {
    allowlistRaw: params.provisioning.allowlistRaw,
    logger: params.provisioning.logger ?? mcpLogger,
  });

  return Object.freeze({
    subject: claims.sub,
    scopes: claims.scopes as ReadonlySet<string>,
    actingUserId,
    tokenExp: claims.exp,
  });
}

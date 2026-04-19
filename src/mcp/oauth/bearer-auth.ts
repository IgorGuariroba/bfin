import type { FastifyRequest } from "fastify";

export function extractBearerToken(req: FastifyRequest): string | null {
  const raw = req.headers.authorization;
  if (!raw || typeof raw !== "string") return null;
  const match = /^\s*Bearer\s+(\S+)\s*$/i.exec(raw);
  if (!match) return null;
  return match[1];
}

export function buildWwwAuthenticateHeader(
  resourceBaseUrl: string,
  error?: "invalid_token" | "expired_token" | "insufficient_scope"
): string {
  const trimmed = resourceBaseUrl.replace(/\/$/, "");
  const metadataUrl = `${trimmed}/.well-known/oauth-protected-resource`;
  const parts = [`Bearer resource_metadata="${metadataUrl}"`];
  if (error) parts.push(`error="${error}"`);
  return parts.join(", ");
}

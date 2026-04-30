import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { TokenValidator, TokenValidationError } from "./oidc.js";
import { findOrCreateUser, UserCreationError } from "../services/user-service.js";
import { errors as joseErrors } from "jose";

export interface AuthUser {
  id: string;
  idProvedor: string;
  nome: string;
  email: string;
  isAdmin: boolean;
}

export interface AuthGuardOptions {
  validateToken: TokenValidator;
  publicRoutes?: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

// /metrics tem esquema próprio (METRICS_TOKEN) aplicado em app.ts, por isso fica fora do auth-guard.
const DEFAULT_PUBLIC_ROUTES = ["/health", "/health/live", "/health/ready", "/metrics", "/privacy"];

async function authGuardPlugin(
  app: FastifyInstance,
  options: AuthGuardOptions
): Promise<void> {
  const validateToken = options.validateToken;
  const publicRoutes = new Set(options.publicRoutes ?? DEFAULT_PUBLIC_ROUTES);

  app.decorateRequest("user", null);

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const pathname = request.url.split("?", 1)[0];
    if (publicRoutes.has(pathname)) {
      return;
    }
    // /mcp/* has its own OAuth 2.1 bearer auth (see src/plugins/mcp-http.ts)
    if (pathname === "/mcp" || pathname.startsWith("/mcp/")) {
      return;
    }
    // RFC 8414 / RFC 9728 OAuth discovery endpoints are public by design.
    if (pathname.startsWith("/.well-known/")) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({
        timestamp: new Date().toISOString(),
        requestId: request.id,
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return reply.status(401).send({
        timestamp: new Date().toISOString(),
        requestId: request.id,
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    try {
      const claims = await validateToken(token);
      const user = await findOrCreateUser(claims);
      request.user = user;
    } catch (err) {
      if (err instanceof TokenValidationError) {
        return reply.status(401).send({
          timestamp: new Date().toISOString(),
          requestId: request.id,
          message: err.message,
          code: err.code,
        });
      }
      if (err instanceof joseErrors.JWTExpired) {
        return reply.status(401).send({
          timestamp: new Date().toISOString(),
          requestId: request.id,
          message: "Token expired",
          code: "TOKEN_EXPIRED",
        });
      }
      if (
        err instanceof joseErrors.JWSSignatureVerificationFailed ||
        err instanceof joseErrors.JWTInvalid ||
        err instanceof joseErrors.JWTClaimValidationFailed ||
        err instanceof joseErrors.JWKSNoMatchingKey ||
        err instanceof joseErrors.JWKSMultipleMatchingKeys ||
        err instanceof joseErrors.JWKSInvalid ||
        err instanceof joseErrors.JWKInvalid ||
        err instanceof joseErrors.JOSEAlgNotAllowed ||
        err instanceof joseErrors.JWSInvalid
      ) {
        return reply.status(401).send({
          timestamp: new Date().toISOString(),
          requestId: request.id,
          message: "Token invalid",
          code: "TOKEN_INVALID",
        });
      }
      if (err instanceof UserCreationError && err.code === "CLAIMS_INSUFFICIENT") {
        return reply.status(401).send({
          timestamp: new Date().toISOString(),
          requestId: request.id,
          message: err.message,
          code: "CLAIMS_INSUFFICIENT",
        });
      }
      throw err;
    }
  });
}

export const authGuard = fp(authGuardPlugin, { name: "auth-guard" });

export function requireAdmin() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !request.user.isAdmin) {
      return reply.status(403).send({
        timestamp: new Date().toISOString(),
        requestId: request.id,
        message: "Admin access required",
        code: "ADMIN_REQUIRED",
      });
    }
  };
}

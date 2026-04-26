import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadHttpMcpConfig, type HttpMcpConfig } from "../config.js";
import {
  createMcpJwtVerifier,
  type McpJwtVerifier,
} from "../lib/oidc-mcp.js";
import { mcpLogger } from "../mcp/logger.js";
import {
  ServiceAccountBootstrapError,
  loadServiceAccountFromToken,
  type ServiceAccount,
} from "../mcp/identity.js";
import { buildMcpServer } from "../mcp/rpc.js";
import { buildToolRegistry } from "../mcp/tools/index.js";
import {
  buildWwwAuthenticateHeader,
  extractBearerToken,
} from "../mcp/oauth/bearer-auth.js";
import {
  buildProtectedResourceMetadata,
  collectScopes,
} from "../mcp/oauth/metadata.js";
import { mcpAuthFailuresTotal, mcpActiveSessions } from "../mcp/metrics.js";
import {
  InMemorySessionStore,
  type McpSession,
  type SessionStore,
} from "../mcp/session-store.js";
import { buildOriginGuard } from "../mcp/transport/origin-guard.js";

const SESSION_HEADER = "mcp-session-id";
const CLEANUP_INTERVAL_MS = 60_000;

const MCP_CORS_ORIGINS = new Set([
  "https://claude.ai",
  "https://app.claude.com",
]);

const MCP_CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Accept",
  "Access-Control-Max-Age": "86400",
};

function isMcpCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (MCP_CORS_ORIGINS.has(origin)) return true;
  return /^http:\/\/localhost:\d+$/.test(origin);
}

// Simple fixed-window rate limiter keyed by string (IP or sub).
// In-process only — not shared across replicas. Evicts expired buckets
// periodically so the map doesn't grow unbounded with unique keys.
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_BUCKET_SWEEP_INTERVAL_MS = 5 * 60_000;

function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count++;
  return bucket.count <= max;
}

function sweepRateBuckets(now: number): number {
  let removed = 0;
  for (const [key, bucket] of rateBuckets) {
    if (now > bucket.resetAt) {
      rateBuckets.delete(key);
      removed++;
    }
  }
  return removed;
}

declare module "fastify" {
  interface FastifyRequest {
    mcpSa?: ServiceAccount;
  }
}

export interface McpHttpPluginOptions {
  config?: HttpMcpConfig;
  verifier?: McpJwtVerifier;
  sessionStore?: SessionStore;
}

function requireSessionId(
  request: FastifyRequest,
  reply: FastifyReply
): string | undefined {
  const incoming = request.headers[SESSION_HEADER];
  const sessionId = typeof incoming === "string" ? incoming : undefined;
  if (!sessionId) {
    reply.code(400).send({ error: "Missing Mcp-Session-Id header" });
    return undefined;
  }
  return sessionId;
}

async function mcpHttpPlugin(
  app: FastifyInstance,
  options: McpHttpPluginOptions
): Promise<void> {
  const rawConfig = options.config ?? loadHttpMcpConfig();
  if (!rawConfig.enabled) {
    app.log.info("MCP HTTP plugin disabled (MCP_HTTP_ENABLED=false)");
    return;
  }
  const config = rawConfig;

  const verifier =
    options.verifier ??
    (await createMcpJwtVerifier({
      issuerUrl: config.authServerUrl,
      audience: config.audience,
    }));

  const sessionStore =
    options.sessionStore ??
    (config.sessionStore === "redis" && config.redisUrl
      ? new (await import("../mcp/session-store-redis.js")).RedisSessionStore({
          redisUrl: config.redisUrl,
        })
      : new InMemorySessionStore());

  const cleanupTimer = setInterval(() => {
    void sessionStore
      .cleanupExpired(Date.now())
      .then((ids) => {
        if (ids.length > 0) {
          mcpActiveSessions.set(sessionStore.size());
          for (const id of ids) {
            app.log.info({ session_id: id }, "MCP session expired, removed");
          }
        }
      })
      .catch((err) => app.log.error({ err }, "MCP session cleanup failed"));
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  const rateSweepTimer = setInterval(() => {
    sweepRateBuckets(Date.now());
  }, RATE_BUCKET_SWEEP_INTERVAL_MS);
  rateSweepTimer.unref();

  app.addHook("onClose", async () => {
    clearInterval(cleanupTimer);
    clearInterval(rateSweepTimer);
    for (const s of sessionStore.all()) {
      try {
        await s.transport.close();
        await s.server.close();
      } catch {
        // ignore
      }
    }
    mcpActiveSessions.set(0);
    const closeFn = (sessionStore as SessionStore).close;
    if (closeFn) await closeFn.call(sessionStore);
  });

  // Origin guard — rejects requests with disallowed Origin (DNS rebinding defense)
  const originGuard = buildOriginGuard({
    allowedOrigins: config.allowedOrigins,
    logger: mcpLogger,
  });

  app.addHook("onRequest", (request, reply, done) => {
    const pathname = request.url.split("?", 1)[0];
    if (
      pathname.startsWith("/mcp") &&
      !pathname.startsWith("/mcp/.well-known") &&
      request.method !== "OPTIONS"
    ) {
      originGuard(request, reply, done);
      return;
    }
    done();
  });

  // CORS for MCP routes and OAuth discovery endpoints (Claude domains + localhost)
  app.addHook("onRequest", async (request, reply) => {
    const pathname = request.url.split("?", 1)[0];
    if (!pathname.startsWith("/mcp") && !pathname.startsWith("/.well-known/")) return;

    const origin = request.headers.origin;
    if (isMcpCorsOrigin(origin)) {
      reply.header("Access-Control-Allow-Origin", origin!);
      for (const [k, v] of Object.entries(MCP_CORS_HEADERS)) {
        reply.header(k, v);
      }
    }

    if (request.method === "OPTIONS") {
      reply.code(204).send();
      return reply;
    }
  });

  // Metadata is derived from the tool registry, which is static at boot —
  // compute once and reuse.
  const cachedMetadata = buildProtectedResourceMetadata({
    config,
    scopes: collectScopes(buildToolRegistry(phantomSa())),
  });

  // Public: RFC 9728 metadata (rate limited by IP).
  // Served at both /.well-known/... (RFC 9728 standard for resources without path)
  // and /mcp/.well-known/... (legacy compatibility).
  const metadataHandler = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<unknown> => {
    if (!checkRateLimit(request.ip, 60, 60_000)) {
      return reply.code(429).send({ error: "rate_limit_exceeded" });
    }
    return cachedMetadata;
  };
  app.get("/.well-known/oauth-protected-resource", metadataHandler);
  app.get("/.well-known/oauth-protected-resource/mcp", metadataHandler);
  app.get("/mcp/.well-known/oauth-protected-resource", metadataHandler);

  // RFC 8414 authorization server metadata — proxied from upstream Auth0.
  // MCP Inspector and similar clients query this to discover the OAuth flow
  // endpoints when they don't follow `authorization_servers` from RFC 9728.
  let cachedAuthServerMetadata: unknown = null;
  const fetchAuthServerMetadata = async (): Promise<unknown> => {
    if (cachedAuthServerMetadata) return cachedAuthServerMetadata;
    const upstream = `${config.authServerUrl}/.well-known/openid-configuration`;
    const res = await fetch(upstream);
    if (!res.ok) {
      throw new Error(`upstream metadata ${upstream} returned ${res.status}`);
    }
    cachedAuthServerMetadata = await res.json();
    return cachedAuthServerMetadata;
  };
  const authServerMetadataHandler = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<unknown> => {
    if (!checkRateLimit(request.ip, 60, 60_000)) {
      return reply.code(429).send({ error: "rate_limit_exceeded" });
    }
    try {
      return await fetchAuthServerMetadata();
    } catch (err) {
      mcpLogger.error({ err }, "Failed to fetch upstream auth server metadata");
      reply.code(502).send({ error: "upstream_metadata_unavailable" });
    }
  };
  app.get("/.well-known/oauth-authorization-server", authServerMetadataHandler);
  app.get("/.well-known/oauth-authorization-server/mcp", authServerMetadataHandler);
  app.get("/mcp/.well-known/oauth-authorization-server", authServerMetadataHandler);
  app.get("/.well-known/openid-configuration", authServerMetadataHandler);
  app.get("/.well-known/openid-configuration/mcp", authServerMetadataHandler);
  app.get("/mcp/.well-known/openid-configuration", authServerMetadataHandler);

  function reply401(
    reply: FastifyReply,
    error: "invalid_token" | "expired_token",
    description: string,
    failureReason: string
  ): false {
    mcpAuthFailuresTotal.inc({ reason: failureReason });
    mcpLogger.warn(
      { error, description, failureReason },
      "MCP auth rejected"
    );
    reply
      .code(401)
      .header(
        "WWW-Authenticate",
        buildWwwAuthenticateHeader(config.baseUrl, error)
      )
      .send({ error, error_description: description });
    return false;
  }

  // Auth middleware for /mcp and /mcp/sse
  const authMiddleware = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<boolean> => {
    const token = extractBearerToken(request);
    if (!token) {
      return reply401(reply, "invalid_token", "Missing Bearer token", "missing_token");
    }

    try {
      const sa = await loadServiceAccountFromToken({
        token,
        verifier,
        provisioning: {
          allowlistRaw: config.provisioningAllowedEmails,
          logger: mcpLogger,
        },
      });
      request.mcpSa = sa;

      // Rate limit per sub (120 tool calls/min)
      const pathname = request.url.split("?", 1)[0];
      if (
        !pathname.startsWith("/mcp/.well-known") &&
        !checkRateLimit(sa.subject, 120, 60_000)
      ) {
        reply.code(429).send({ error: "rate_limit_exceeded" });
        return false;
      }

      return true;
    } catch (err) {
      if (err instanceof ServiceAccountBootstrapError) {
        if (err.code === "TOKEN_EXPIRED") {
          return reply401(reply, "expired_token", err.message, "expired_token");
        }
        if (err.code === "TOKEN_INVALID" || err.code === "SUBJECT_MISSING") {
          return reply401(reply, "invalid_token", err.message, "invalid_token");
        }
        if (err.code === "USER_NOT_FOUND") {
          mcpAuthFailuresTotal.inc({ reason: "user_not_provisioned" });
          reply
            .code(403)
            .send({ error: "forbidden", error_description: err.message });
          return false;
        }
      }
      app.log.error({ err }, "MCP auth unexpected error");
      reply.code(500).send({ error: "server_error" });
      return false;
    }
  };

  // POST /mcp — handles initialize and subsequent RPC calls
  app.route({
    method: "POST",
    url: "/mcp",
    handler: async (request, reply) => {
      const ok = await authMiddleware(request, reply);
      if (!ok) return;
      const sa = request.mcpSa!;

      const incomingSessionId = request.headers[SESSION_HEADER];
      const sessionId =
        typeof incomingSessionId === "string" ? incomingSessionId : undefined;

      const session: McpSession | undefined = sessionId
        ? await sessionStore.get(sessionId)
        : undefined;

      if (!session) {
        const newSessionId = randomUUID();
        const registry = buildToolRegistry(sa);
        const server = buildMcpServer({ sa, registry, logger: mcpLogger });
        const transport: StreamableHTTPServerTransport =
          new StreamableHTTPServerTransport({
            sessionIdGenerator: () => newSessionId,
            onsessioninitialized: async (id) => {
              await sessionStore.put({
                sessionId: id,
                transport,
                server,
                sa,
                createdAt: Date.now(),
                lastActivity: Date.now(),
              });
              mcpActiveSessions.set(sessionStore.size());
              app.log.info(
                { session_id: id, sub: sa.subject, user_id: sa.actingUserId },
                "MCP session initialized"
              );
            },
            onsessionclosed: async (id) => {
              await sessionStore.delete(id);
              mcpActiveSessions.set(sessionStore.size());
              app.log.info({ session_id: id }, "MCP session closed");
            },
          });

        await server.connect(transport);
        await transport.handleRequest(request.raw, reply.raw, request.body);
        return reply;
      }

      await sessionStore.touch(session.sessionId);
      await session.transport.handleRequest(
        request.raw,
        reply.raw,
        request.body
      );
      return reply;
    },
  });

  // GET /mcp — SSE stream bound to an existing session
  app.route({
    method: "GET",
    url: "/mcp",
    handler: async (request, reply) => {
      const ok = await authMiddleware(request, reply);
      if (!ok) return;

      const sessionId = requireSessionId(request, reply);
      if (!sessionId) return;
      const session = await sessionStore.get(sessionId);
      if (!session) {
        reply.code(404).send({ error: "Session not found" });
        return;
      }
      await sessionStore.touch(sessionId);
      await session.transport.handleRequest(request.raw, reply.raw);
      return reply;
    },
  });

  // DELETE /mcp — client-initiated session termination
  app.route({
    method: "DELETE",
    url: "/mcp",
    handler: async (request, reply) => {
      const ok = await authMiddleware(request, reply);
      if (!ok) return;

      const sessionId = requireSessionId(request, reply);
      if (!sessionId) return;
      const session = await sessionStore.get(sessionId);
      if (!session) {
        reply.code(204).send();
        return;
      }
      await session.transport.handleRequest(request.raw, reply.raw);
      return reply;
    },
  });
}

// Used only to enumerate scopes for metadata — whoami is the only tool that
// needs a SA, and it won't run here.
function phantomSa(): ServiceAccount {
  return Object.freeze({
    subject: "scope-enumerator",
    scopes: new Set<string>() as ReadonlySet<string>,
    actingUserId: "00000000-0000-0000-0000-000000000000",
    tokenExp: undefined,
  });
}

export const mcpHttp = fp(mcpHttpPlugin, { name: "mcp-http" });

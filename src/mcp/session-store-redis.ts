import Redis from "ioredis";
import type {
  McpSession,
  SessionStore,
} from "./session-store.js";
import type { ServiceAccount } from "./identity.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const DEFAULT_TTL_SECONDS = 3600;
const KEY_PREFIX = "mcp:session:";
const SET_KEY = "mcp:sessions";

interface StoredSessionMeta {
  sessionId: string;
  sa: {
    subject: string;
    scopes: string[];
    actingUserId: string;
    tokenExp: number | undefined;
  };
  createdAt: number;
  lastActivity: number;
}

export interface RedisSessionStoreOptions {
  redisUrl: string;
  ttlSeconds?: number;
}

export class RedisSessionStore implements SessionStore {
  private readonly redis: Redis;
  private readonly ttlSeconds: number;
  // Local cache for non-serializable objects (transport + server)
  private readonly locals = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: Server }
  >();

  constructor(opts: RedisSessionStoreOptions) {
    this.redis = new Redis(opts.redisUrl, {
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });
    this.ttlSeconds = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  private key(sessionId: string): string {
    return `${KEY_PREFIX}${sessionId}`;
  }

  private serializeMeta(session: McpSession): string {
    const meta: StoredSessionMeta = {
      sessionId: session.sessionId,
      sa: {
        subject: session.sa.subject,
        scopes: Array.from(session.sa.scopes),
        actingUserId: session.sa.actingUserId,
        tokenExp: session.sa.tokenExp,
      },
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    };
    return JSON.stringify(meta);
  }

  private deserializeMeta(raw: string): Omit<McpSession, "transport" | "server"> {
    const meta: StoredSessionMeta = JSON.parse(raw);
    return {
      sessionId: meta.sessionId,
      sa: Object.freeze({
        subject: meta.sa.subject,
        scopes: new Set(meta.sa.scopes) as ReadonlySet<string>,
        actingUserId: meta.sa.actingUserId,
        tokenExp: meta.sa.tokenExp,
      }) as ServiceAccount,
      createdAt: meta.createdAt,
      lastActivity: meta.lastActivity,
    };
  }

  async put(session: McpSession): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.set(
      this.key(session.sessionId),
      this.serializeMeta(session),
      "EX",
      this.ttlSeconds
    );
    pipeline.sadd(SET_KEY, session.sessionId);
    await pipeline.exec();
    this.locals.set(session.sessionId, {
      transport: session.transport,
      server: session.server,
    });
  }

  async get(sessionId: string): Promise<McpSession | undefined> {
    const raw = await this.redis.get(this.key(sessionId));
    if (!raw) {
      this.locals.delete(sessionId);
      return undefined;
    }
    const meta = this.deserializeMeta(raw);
    const local = this.locals.get(sessionId);
    if (!local) {
      // Session metadata exists in Redis but transport/server were lost
      // (e.g., process restart). We cannot recover the live objects;
      // caller must treat as non-existent and recreate via initialize.
      return undefined;
    }
    return {
      ...meta,
      transport: local.transport,
      server: local.server,
    };
  }

  async touch(sessionId: string): Promise<void> {
    await this.redis.expire(this.key(sessionId), this.ttlSeconds);
  }

  async delete(sessionId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.del(this.key(sessionId));
    pipeline.srem(SET_KEY, sessionId);
    await pipeline.exec();
    this.locals.delete(sessionId);
  }

  async cleanupExpired(_now: number): Promise<string[]> {
    // Redis TTL handles expiration automatically; we just clean up orphaned locals.
    const expired: string[] = [];
    for (const id of this.locals.keys()) {
      const exists = await this.redis.exists(this.key(id));
      if (!exists) {
        expired.push(id);
        this.locals.delete(id);
      }
    }
    return expired;
  }

  *all(): Iterable<McpSession> {
    // Return only locally-held sessions (those with live transport/server).
    // cleanupExpired removes entries that have expired in Redis.
    for (const [id, local] of this.locals) {
      yield {
        sessionId: id,
        transport: local.transport,
        server: local.server,
        sa: Object.freeze({
          subject: "",
          scopes: new Set<string>() as ReadonlySet<string>,
          actingUserId: "",
          tokenExp: undefined,
        }) as ServiceAccount,
        createdAt: 0,
        lastActivity: 0,
      };
    }
  }

  size(): number {
    return this.locals.size;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

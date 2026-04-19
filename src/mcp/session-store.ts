import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ServiceAccount } from "./identity.js";

export interface McpSession {
  sessionId: string;
  transport: StreamableHTTPServerTransport;
  server: Server;
  sa: ServiceAccount;
  createdAt: number;
  lastActivity: number;
}

export interface SessionStore {
  put(session: McpSession): Promise<void>;
  get(sessionId: string): Promise<McpSession | undefined>;
  touch(sessionId: string): Promise<void>;
  delete(sessionId: string): Promise<void>;
  cleanupExpired(now: number): Promise<string[]>;
  all(): Iterable<McpSession>;
  size(): number;
  close?(): Promise<void>;
}

export interface InMemorySessionStoreOptions {
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export class InMemorySessionStore implements SessionStore {
  private readonly map = new Map<string, McpSession>();
  private readonly ttlMs: number;

  constructor(opts: InMemorySessionStoreOptions = {}) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  }

  async put(session: McpSession): Promise<void> {
    this.map.set(session.sessionId, session);
  }

  async get(sessionId: string): Promise<McpSession | undefined> {
    return this.map.get(sessionId);
  }

  async touch(sessionId: string): Promise<void> {
    const s = this.map.get(sessionId);
    if (s) s.lastActivity = Date.now();
  }

  async delete(sessionId: string): Promise<void> {
    this.map.delete(sessionId);
  }

  async cleanupExpired(now: number): Promise<string[]> {
    const expired: string[] = [];
    for (const [id, s] of this.map) {
      if (now - s.lastActivity > this.ttlMs) {
        expired.push(id);
        this.map.delete(id);
      }
    }
    return expired;
  }

  all(): Iterable<McpSession> {
    return this.map.values();
  }

  size(): number {
    return this.map.size;
  }
}

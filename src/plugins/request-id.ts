import { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

export async function requestIdPlugin(_app: FastifyInstance): Promise<void> {
  // Fastify built-in genReqId is configured at instance creation time,
  // so this plugin is a no-op registration that documents the intent.
  // The actual configuration lives in app.ts.
}

export function generateRequestId(): string {
  return `req-${randomUUID()}`;
}

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { FastifyInstance } from "fastify";
import { register } from "prom-client";

export interface TestApp {
  app: FastifyInstance;
  client: postgres.Sql;
  db: ReturnType<typeof drizzle>;
  truncateAll(): Promise<void>;
  teardown(): Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TEST_DATABASE_URL not set — did globalSetup run?");
  }
  process.env.DATABASE_URL = databaseUrl;

  // fastify-metrics uses prom-client's default registry — clear it so
  // subsequent buildApp() calls in the same process don't double-register.
  register.clear();

  const { buildApp } = await import("../../src/app.js");
  const app = buildApp();

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle({ client });

  return {
    app,
    client,
    db,
    async truncateAll() {
      const rows = await client<{ tablename: string }[]>`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
      `;
      if (rows.length === 0) return;
      const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
      await client.unsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    },
    async teardown() {
      await app.close();
      await client.end();
    },
  };
}

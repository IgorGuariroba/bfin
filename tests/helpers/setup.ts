import { PostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { FastifyInstance } from "fastify";

export interface TestApp {
  app: FastifyInstance;
  container: PostgreSqlContainer;
  client: postgres.Sql;
  db: ReturnType<typeof drizzle>;
  beginTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  teardown(): Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const databaseUrl = container.getConnectionUri();

  process.env.DATABASE_URL = databaseUrl;

  // Dynamic import to ensure DATABASE_URL is set before any module evaluation
  const { buildApp } = await import("../../src/app.js");
  const app = buildApp();

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle({ client });

  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  return {
    app,
    container,
    client,
    db,
    async beginTransaction() {
      await client`BEGIN`;
    },
    async rollbackTransaction() {
      await client`ROLLBACK`;
    },
    async teardown() {
      await client.end();
      await container.stop();
    },
  };
}

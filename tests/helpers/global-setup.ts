import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

let container: StartedPostgreSqlContainer | undefined;

export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const databaseUrl = container.getConnectionUri();

  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "error";

  // Propagate to test workers
  process.env.TEST_DATABASE_URL = databaseUrl;

  const client = postgres(databaseUrl, { max: 1 });
  try {
    const db = drizzle({ client });
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
  } finally {
    await client.end();
  }
}

export async function teardown(): Promise<void> {
  await container?.stop();
}

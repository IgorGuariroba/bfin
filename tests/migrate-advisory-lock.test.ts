import { describe, it, expect } from "vitest";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

describe("Migration advisory lock", () => {
  it("allows two concurrent runs without corrupting state", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const databaseUrl = container.getConnectionUri();

    // Set up two independent clients
    const client1 = postgres(databaseUrl, { max: 1 });
    const client2 = postgres(databaseUrl, { max: 1 });
    const db1 = drizzle({ client: client1 });
    const db2 = drizzle({ client: client2 });

    const ADVISORY_LOCK_ID = 42_424_242;

    async function runMigrationsWithLock(db: ReturnType<typeof drizzle>, client: postgres.Sql, label: string) {
      const start = Date.now();
      while (true) {
        const [result] = await client`
          SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) AS acquired
        `;
        if (result.acquired) break;
        if (Date.now() - start >= 60_000) throw new Error(`${label}: lock timeout`);
        await new Promise((r) => setTimeout(r, 1000));
      }
      try {
        await migrate(db, { migrationsFolder: "./src/db/migrations" });
      } finally {
        await client`
          SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID}) AS released
        `;
      }
    }

    // Run both concurrently
    const results = await Promise.allSettled([
      runMigrationsWithLock(db1, client1, "first"),
      runMigrationsWithLock(db2, client2, "second"),
    ]);

    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("fulfilled");

    await client1.end();
    await client2.end();
    await container.stop();
  }, 30_000);
});

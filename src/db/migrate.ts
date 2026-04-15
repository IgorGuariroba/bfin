import { migrate } from "drizzle-orm/postgres-js/migrator";
import { client, db } from "./index.js";

const ADVISORY_LOCK_ID = 42_424_242;
const LOCK_TIMEOUT_MS = 60_000;

export async function runMigrations(): Promise<void> {
  const lockStart = Date.now();

  // Attempt to acquire advisory lock with a timeout
  while (true) {
    const [result] = await client`
      SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) AS acquired
    `;
    if (result.acquired) {
      break;
    }
    if (Date.now() - lockStart >= LOCK_TIMEOUT_MS) {
      throw new Error(`Could not acquire migration advisory lock within ${LOCK_TIMEOUT_MS}ms`);
    }
    await sleep(1000);
  }

  try {
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
  } finally {
    await client`
      SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID}) AS released
    `;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

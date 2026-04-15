import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";

export const client = postgres(config.databaseUrl, {
  max: config.dbPoolMax,
  idle_timeout: config.dbPoolIdleTimeout,
  connect_timeout: config.dbPoolConnectTimeout,
});

export const db = drizzle({ client });

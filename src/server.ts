import { buildApp } from "./app.js";
import { ConfigError, config } from "./config.js";
import { client } from "./db/index.js";
import { waitForDatabase } from "./db/retry.js";
import { runMigrations } from "./db/migrate.js";
import { initOidc } from "./plugins/oidc.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  const app = buildApp();

  // Initialize OIDC before accepting requests
  app.log.info("Initializing OIDC...");
  await initOidc();
  app.log.info("OIDC initialized");

  // Boot readiness probe
  app.log.info("Waiting for database...");
  await waitForDatabase();
  app.log.info("Database is ready");

  // Run migrations if configured
  if (config.migrateOnBoot) {
    app.log.info("Running migrations...");
    await runMigrations();
    app.log.info("Migrations complete");
  }

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down gracefully");

    const forceExit = setTimeout(() => {
      app.log.error("Forced exit after shutdown timeout");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      await app.close();
      await client.end();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));

  app.listen({ port: config.port, host: "0.0.0.0" }, (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
    const address = app.server.address();
    const port = typeof address === "string" ? address : address?.port;
    app.log.info(`Server listening at http://0.0.0.0:${port}`);
  });
}

main().catch((err) => {
  if (err instanceof ConfigError) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});

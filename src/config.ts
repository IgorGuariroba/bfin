import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL cannot be empty"),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().int().positive().default(60_000),
  MIGRATE_ON_BOOT: z.enum(["true", "false"]).default("false"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_POOL_IDLE_TIMEOUT: z.coerce.number().int().nonnegative().default(30),
  DB_POOL_CONNECT_TIMEOUT: z.coerce.number().int().nonnegative().default(10),
  METRICS_TOKEN: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
});

export type Config = {
  port: number;
  nodeEnv: "development" | "production" | "test";
  databaseUrl: string;
  corsOrigin: string | undefined;
  rateLimitMax: number;
  rateLimitWindow: number;
  migrateOnBoot: boolean;
  logLevel: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  dbPoolMax: number;
  dbPoolIdleTimeout: number;
  dbPoolConnectTimeout: number;
  metricsToken: string | undefined;
};

export class ConfigError extends Error {
  override name = "ConfigError";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new ConfigError(`Invalid environment variables:\n${issues}`);
  }

  const v = parsed.data;
  return {
    port: v.PORT,
    nodeEnv: v.NODE_ENV,
    databaseUrl: v.DATABASE_URL,
    corsOrigin: v.CORS_ORIGIN,
    rateLimitMax: v.RATE_LIMIT_MAX,
    rateLimitWindow: v.RATE_LIMIT_WINDOW,
    migrateOnBoot: v.MIGRATE_ON_BOOT === "true",
    logLevel: v.LOG_LEVEL,
    dbPoolMax: v.DB_POOL_MAX,
    dbPoolIdleTimeout: v.DB_POOL_IDLE_TIMEOUT,
    dbPoolConnectTimeout: v.DB_POOL_CONNECT_TIMEOUT,
    metricsToken: v.METRICS_TOKEN,
  };
}

let cachedConfig: Config | undefined;

export const config: Config = new Proxy({} as Config, {
  get(_, prop) {
    cachedConfig ??= loadConfig();
    return cachedConfig[prop as keyof Config];
  },
  ownKeys() {
    cachedConfig ??= loadConfig();
    return Reflect.ownKeys(cachedConfig);
  },
  getOwnPropertyDescriptor(_, prop) {
    cachedConfig ??= loadConfig();
    return Object.getOwnPropertyDescriptor(cachedConfig, prop);
  },
  has(_, prop) {
    cachedConfig ??= loadConfig();
    return prop in cachedConfig;
  },
});

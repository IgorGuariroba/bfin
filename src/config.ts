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
  ADMIN_EMAILS: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  OIDC_ISSUER_URL: z.string().min(1, "OIDC_ISSUER_URL cannot be empty"),
  OIDC_AUDIENCE: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  OIDC_ALLOW_INSECURE: z.enum(["true", "false"]).default("false"),
  DEMO_ACCOUNT_ID: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.uuid().optional()
  ),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === "production" && !data.DEMO_ACCOUNT_ID) {
    ctx.addIssue({
      code: "custom",
      path: ["DEMO_ACCOUNT_ID"],
      message: "DEMO_ACCOUNT_ID is required when NODE_ENV=production",
    });
  }
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
  adminEmails: ReadonlySet<string>;
  oidcIssuerUrl: string;
  oidcAudience: string | undefined;
  oidcAllowInsecure: boolean;
  demoAccountId: string | undefined;
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
    adminEmails: new Set((v.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)),
    oidcIssuerUrl: v.OIDC_ISSUER_URL,
    oidcAudience: v.OIDC_AUDIENCE,
    oidcAllowInsecure: v.OIDC_ALLOW_INSECURE === "true",
    demoAccountId: v.DEMO_ACCOUNT_ID,
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

const httpMcpEnabledSchema = z.object({
  MCP_HTTP_ENABLED: z.enum(["true", "false"]).default("false"),
});

const httpMcpEnabledConfigSchema = z.object({
  MCP_HTTP_BASE_URL: z.url("MCP_HTTP_BASE_URL must be a valid URL"),
  MCP_AUDIENCE_HTTP: z.string().min(1, "MCP_AUDIENCE_HTTP cannot be empty"),
  MCP_AUTH_SERVER_URL: z.url("MCP_AUTH_SERVER_URL must be a valid URL"),
  MCP_PROVISIONING_ALLOWED_EMAILS: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().optional()
  ),
  MCP_SESSION_STORE: z.enum(["memory", "redis"]).default("memory"),
  REDIS_URL: z.string().optional(),
  MCP_ALLOWED_ORIGINS: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().optional()
  ),
}).refine((data) => data.MCP_SESSION_STORE !== "redis" || (data.REDIS_URL && data.REDIS_URL.length > 0), {
  message: "REDIS_URL is required when MCP_SESSION_STORE=redis",
  path: ["REDIS_URL"],
});

export type HttpMcpConfig =
  | {
      enabled: false;
    }
  | {
      enabled: true;
      baseUrl: string;
      audience: string;
      authServerUrl: string;
      provisioningAllowedEmails: string | undefined;
      sessionStore: "memory" | "redis";
      redisUrl: string | undefined;
      allowedOrigins: ReadonlySet<string>;
    };

export function loadHttpMcpConfig(env: NodeJS.ProcessEnv = process.env): HttpMcpConfig {
  const gate = httpMcpEnabledSchema.safeParse(env);
  if (!gate.success || gate.data.MCP_HTTP_ENABLED !== "true") {
    return { enabled: false };
  }

  const parsed = httpMcpEnabledConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new ConfigError(`Invalid MCP HTTP environment variables:\n${issues}`);
  }

  const v = parsed.data;
  const DEFAULT_MCP_ORIGINS = "https://claude.ai,https://app.claude.com";
  const allowedOrigins = new Set(
    (v.MCP_ALLOWED_ORIGINS ?? DEFAULT_MCP_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean)
  );
  return {
    enabled: true,
    baseUrl: v.MCP_HTTP_BASE_URL.replace(/\/$/, ""),
    audience: v.MCP_AUDIENCE_HTTP,
    authServerUrl: v.MCP_AUTH_SERVER_URL.replace(/\/$/, ""),
    provisioningAllowedEmails: v.MCP_PROVISIONING_ALLOWED_EMAILS,
    sessionStore: v.MCP_SESSION_STORE,
    redisUrl: v.REDIS_URL,
    allowedOrigins,
  };
}

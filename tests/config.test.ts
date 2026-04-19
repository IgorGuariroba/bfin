import { describe, it, expect } from "vitest";
import { ConfigError, loadConfig, loadHttpMcpConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("throws ConfigError when DATABASE_URL is missing", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    try {
      loadConfig({});
    } catch (err) {
      expect((err as Error).message).toContain("Invalid environment variables:");
      expect((err as Error).message).toContain("DATABASE_URL");
    }
  });

  it("throws ConfigError when DATABASE_URL is empty", () => {
    expect(() => loadConfig({ DATABASE_URL: "" })).toThrow(/DATABASE_URL cannot be empty/);
  });

  it("applies default values for optional envs", () => {
    const cfg = loadConfig({ DATABASE_URL: "postgres://fake", OIDC_ISSUER_URL: "https://test" });
    expect(cfg.port).toBe(3000);
    expect(cfg.nodeEnv).toBe("development");
    expect(cfg.logLevel).toBe("info");
    expect(cfg.migrateOnBoot).toBe(false);
    expect(cfg.metricsToken).toBeUndefined();
  });

  it("coerces numeric envs", () => {
    const cfg = loadConfig({
      DATABASE_URL: "postgres://fake",
      OIDC_ISSUER_URL: "https://test",
      PORT: "8080",
      RATE_LIMIT_MAX: "50",
    });
    expect(cfg.port).toBe(8080);
    expect(cfg.rateLimitMax).toBe(50);
  });

  it("parses optional envs correctly", () => {
    const cfg = loadConfig({
      DATABASE_URL: "postgres://fake",
      OIDC_ISSUER_URL: "https://test",
      CORS_ORIGIN: "https://app.example.com",
      METRICS_TOKEN: "secret",
      OIDC_AUDIENCE: "aud",
      OIDC_ALLOW_INSECURE: "true",
      MIGRATE_ON_BOOT: "true",
      NODE_ENV: "production",
      DB_POOL_MAX: "20",
      DB_POOL_IDLE_TIMEOUT: "60",
      DB_POOL_CONNECT_TIMEOUT: "5",
    });
    expect(cfg.corsOrigin).toBe("https://app.example.com");
    expect(cfg.metricsToken).toBe("secret");
    expect(cfg.oidcAudience).toBe("aud");
    expect(cfg.oidcAllowInsecure).toBe(true);
    expect(cfg.migrateOnBoot).toBe(true);
    expect(cfg.nodeEnv).toBe("production");
    expect(cfg.dbPoolMax).toBe(20);
    expect(cfg.dbPoolIdleTimeout).toBe(60);
    expect(cfg.dbPoolConnectTimeout).toBe(5);
  });

  it("treats empty optional strings as undefined", () => {
    const cfg = loadConfig({
      DATABASE_URL: "postgres://fake",
      OIDC_ISSUER_URL: "https://test",
      CORS_ORIGIN: "",
      METRICS_TOKEN: "",
      OIDC_AUDIENCE: "",
    });
    expect(cfg.corsOrigin).toBeUndefined();
    expect(cfg.metricsToken).toBeUndefined();
    expect(cfg.oidcAudience).toBeUndefined();
  });
});

describe("loadHttpMcpConfig", () => {
  it("returns disabled when MCP_HTTP_ENABLED is missing", () => {
    const cfg = loadHttpMcpConfig({});
    expect(cfg.enabled).toBe(false);
  });

  it("returns disabled when MCP_HTTP_ENABLED is false", () => {
    const cfg = loadHttpMcpConfig({ MCP_HTTP_ENABLED: "false" });
    expect(cfg.enabled).toBe(false);
  });

  it("returns enabled config with defaults", () => {
    const cfg = loadHttpMcpConfig({
      MCP_HTTP_ENABLED: "true",
      MCP_HTTP_BASE_URL: "https://api.example.com/mcp/",
      MCP_AUDIENCE_HTTP: "aud",
      MCP_AUTH_SERVER_URL: "https://auth.example.com/",
    });
    expect(cfg.enabled).toBe(true);
    expect(cfg).toMatchObject({
      baseUrl: "https://api.example.com/mcp",
      audience: "aud",
      authServerUrl: "https://auth.example.com",
      sessionStore: "memory",
      provisioningAllowedEmails: undefined,
      redisUrl: undefined,
    });
  });

  it("throws ConfigError when required MCP fields are missing", () => {
    expect(() =>
      loadHttpMcpConfig({
        MCP_HTTP_ENABLED: "true",
        MCP_HTTP_BASE_URL: "not-a-url",
        MCP_AUDIENCE_HTTP: "",
        MCP_AUTH_SERVER_URL: "",
      })
    ).toThrow(ConfigError);
  });

  it("throws ConfigError when REDIS_URL is missing with redis session store", () => {
    expect(() =>
      loadHttpMcpConfig({
        MCP_HTTP_ENABLED: "true",
        MCP_HTTP_BASE_URL: "https://api.example.com/mcp",
        MCP_AUDIENCE_HTTP: "aud",
        MCP_AUTH_SERVER_URL: "https://auth.example.com",
        MCP_SESSION_STORE: "redis",
      })
    ).toThrow(ConfigError);
  });

  it("allows redis session store when REDIS_URL is provided", () => {
    const cfg = loadHttpMcpConfig({
      MCP_HTTP_ENABLED: "true",
      MCP_HTTP_BASE_URL: "https://api.example.com/mcp",
      MCP_AUDIENCE_HTTP: "aud",
      MCP_AUTH_SERVER_URL: "https://auth.example.com",
      MCP_SESSION_STORE: "redis",
      REDIS_URL: "redis://localhost:6379",
    });
    expect(cfg.enabled).toBe(true);
    expect(cfg).toMatchObject({
      sessionStore: "redis",
      redisUrl: "redis://localhost:6379",
    });
  });
});

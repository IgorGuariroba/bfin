import { describe, it, expect } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";

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
    const cfg = loadConfig({ DATABASE_URL: "postgres://fake" });
    expect(cfg.port).toBe(3000);
    expect(cfg.nodeEnv).toBe("development");
    expect(cfg.logLevel).toBe("info");
    expect(cfg.migrateOnBoot).toBe(false);
    expect(cfg.metricsToken).toBeUndefined();
  });

  it("coerces numeric envs", () => {
    const cfg = loadConfig({
      DATABASE_URL: "postgres://fake",
      PORT: "8080",
      RATE_LIMIT_MAX: "50",
    });
    expect(cfg.port).toBe(8080);
    expect(cfg.rateLimitMax).toBe(50);
  });
});

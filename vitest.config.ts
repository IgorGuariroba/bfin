import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    timeout: 120000,
    hookTimeout: 120000,
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    setupFiles: ["tests/helpers/vitest-setup.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: "istanbul",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "coverage/lcov",
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 55,
        branches: 55,
      },
    },
  },
});

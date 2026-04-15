import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    timeout: 120000,
    hookTimeout: 120000,
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});

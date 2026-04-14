import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    timeout: 120000,
    include: ["tests/**/*.test.ts"],
  },
});

import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

export default tseslint.config(
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    ignores: ["dist/", "node_modules/", "drizzle/"],
  },
  {
    rules: {
      "sonarjs/void-use": "off",
      "sonarjs/cognitive-complexity": "warn",
      "sonarjs/no-nested-conditional": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/mcp/**/*.ts"],
    rules: {
      "no-console": "error",
    },
  },
);

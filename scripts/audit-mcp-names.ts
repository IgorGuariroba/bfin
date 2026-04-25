/**
 * Audits MCP tool names: fails if any tool name exceeds 64 characters.
 * Scans tool source files directly via regex to avoid importing DB/config.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MAX_NAME_LENGTH = 64;
const TOOLS_DIR = new URL("../src/mcp/tools/", import.meta.url).pathname;

const TOOL_NAME_RE = /name:\s*["']([a-z0-9_-]+)["']/g;

const files = readdirSync(TOOLS_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts");

const names: string[] = [];

for (const file of files) {
  const content = readFileSync(join(TOOLS_DIR, file), "utf-8");
  for (const match of content.matchAll(TOOL_NAME_RE)) {
    names.push(match[1]);
  }
}

if (names.length === 0) {
  console.error("ERROR: no tool names found");
  process.exit(1);
}

const violators = names.filter((n) => n.length > MAX_NAME_LENGTH);

if (violators.length > 0) {
  console.error("FAIL: tool names exceed 64 chars:");
  for (const n of violators) {
    console.error(`  ${n} (${n.length} chars)`);
  }
  process.exit(1);
}

console.log(`OK: ${names.length} tool names, all ≤ ${MAX_NAME_LENGTH} chars`);

/**
 * Audits MCP tool descriptions: fails if any description contains banned phrases.
 * Scans tool source files directly via regex to avoid importing DB/config.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BANNED_PHRASES } from "../src/mcp/tools/__lint__/banned-phrases.js";

const TOOLS_DIR = new URL("../src/mcp/tools/", import.meta.url).pathname;
const DESC_RE = /description:\s*[`"'](.+?)[`"']\s*[,}\n]/gs;

const files = readdirSync(TOOLS_DIR).filter(
  (f) => f.endsWith(".ts") && f !== "index.ts" && !f.includes("__")
);

interface Violation {
  file: string;
  description: string;
  pattern: string;
  label: string;
}

const violations: Violation[] = [];

for (const file of files) {
  const content = readFileSync(join(TOOLS_DIR, file), "utf-8");
  for (const match of content.matchAll(DESC_RE)) {
    const desc = match[1];
    for (const [regex, label] of BANNED_PHRASES) {
      if (regex.test(desc)) {
        violations.push({ file, description: desc.slice(0, 80), pattern: regex.source, label });
      }
    }
  }
}

if (violations.length > 0) {
  console.error("FAIL: banned phrases found in tool descriptions:");
  for (const v of violations) {
    console.error(`  ${v.file}: [${v.label}] in "${v.description}..."`);
  }
  process.exit(1);
}

console.log(`OK: ${files.length} tool files scanned, no banned phrases`);

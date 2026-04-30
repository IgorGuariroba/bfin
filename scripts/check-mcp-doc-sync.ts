import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

interface ToolInfo {
  name: string;
  title: string;
  description: string;
  requiredScope: string | null;
}

const READ_ONLY_SUFFIXES = new Set(["list", "get", "whoami"]);

const ACTION_TITLES: Record<string, string> = {
  list: "List",
  get: "Get",
  create: "Create",
  update: "Update",
  delete: "Delete",
  set: "Set",
  "pay-installment": "Pay Installment",
  add: "Add",
  whoami: "Introspect Identity",
};

function humanizeDomain(domain: string): string {
  return domain
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function deriveTitle(name: string): string {
  if (name === "mcp_whoami") return "Introspect Identity";
  const lastUnderscore = name.lastIndexOf("_");
  const action = name.slice(lastUnderscore + 1);
  const domain = name.slice(0, lastUnderscore);
  const verb = ACTION_TITLES[action] ?? action.charAt(0).toUpperCase() + action.slice(1);
  return `${verb} ${humanizeDomain(domain)}`;
}

function extractToolsFromSource(): ToolInfo[] {
  const toolsDir = resolve(process.cwd(), "src/mcp/tools");
  const files = readdirSync(toolsDir).filter(
    (f) => f.endsWith(".ts") && f !== "index.ts" && !f.startsWith("__")
  );

  const tools: ToolInfo[] = [];

  for (const file of files) {
    const content = readFileSync(resolve(toolsDir, file), "utf-8");
    const toolBlocks = content.split("name:").slice(1);

    for (const block of toolBlocks) {
      const nameMatch = block.match(/"([^"]+)"/);
      if (!nameMatch) continue;
      const name = nameMatch[1];

      const descMatch = block.match(/description:\s*(?:`([^`]+)`|"([^"]+)"|'([^']+)'|\[([^\]]+)\])/);
      let description = "";
      if (descMatch) {
        description = descMatch.slice(1).find(Boolean) ?? "";
      }
      // fallback: multi-line description
      if (!description) {
        const multiDesc = block.match(/description:\s*([\s\S]*?)(?:,\s*requiredScope|,?\s*\n\s*\})/);
        if (multiDesc) {
          description = multiDesc[1]
            .replace(/\s+/g, " ")
            .trim()
            .replace(/^["'`]|["'`]$/g, "");
        }
      }
      // clean up template literal backticks and interpolation
      description = description.replace(/\$\{[^}]+\}/g, "").trim();

      const scopeMatch = block.match(/requiredScope:\s*"([^"]+)"/);
      const requiredScope = scopeMatch ? scopeMatch[1] : null;

      tools.push({ name, title: deriveTitle(name), description, requiredScope });
    }
  }

  return tools.sort((a, b) => a.name.localeCompare(b.name));
}

function extractToolsFromDoc(): Map<string, { title: string; description: string; scope: string }> {
  const docPath = resolve(process.cwd(), "docs/mcp.md");
  const content = readFileSync(docPath, "utf-8");

  const tableStart = content.indexOf("## Tools");
  if (tableStart === -1) throw new Error("## Tools section not found in docs/mcp.md");

  const afterHeading = content.slice(tableStart);
  const nextHeading = afterHeading.search(/\n## /);
  const section = nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading);
  const tableLines = section
    .split("\n")
    .filter((l) => l.startsWith("| `") && !l.includes("---|"));

  const map = new Map<string, { title: string; description: string; scope: string }>();

  for (const line of tableLines) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 5) continue;
    const name = cells[1].replace(/`/g, "");
    const title = cells[2];
    const description = cells[3];
    const scope = cells[4].replace(/`/g, "");
    map.set(name, { title, description, scope });
  }

  return map;
}

function main() {
  const sourceTools = extractToolsFromSource();
  const docTools = extractToolsFromDoc();

  const errors: string[] = [];

  for (const tool of sourceTools) {
    const doc = docTools.get(tool.name);
    if (!doc) {
      errors.push(`Missing in docs: ${tool.name}`);
      continue;
    }
    if (doc.title !== tool.title) {
      errors.push(`Title mismatch for ${tool.name}: doc='${doc.title}' source='${tool.title}'`);
    }
    if (doc.scope !== (tool.requiredScope ?? "—")) {
      errors.push(`Scope mismatch for ${tool.name}: doc='${doc.scope}' source='${tool.requiredScope ?? "—"}'`);
    }
  }

  for (const name of docTools.keys()) {
    if (!sourceTools.find((t) => t.name === name)) {
      errors.push(`Stale in docs: ${name}`);
    }
  }

  if (errors.length > 0) {
    console.error("MCP doc sync failed:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(`MCP doc sync OK (${sourceTools.length} tools).`);
}

main();

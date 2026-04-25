import type { McpToolAny } from "../../tool-types.js";

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

function isReadOnlyAction(name: string): boolean {
  if (name === "mcp_whoami") return true;
  const action = name.split("_").pop() ?? "";
  return READ_ONLY_SUFFIXES.has(action);
}

export function withAnnotations<T extends McpToolAny>(tool: T): T & {
  annotations: { title: string; readOnlyHint?: true; destructiveHint?: true };
} {
  const readOnly = isReadOnlyAction(tool.name);
  return {
    ...tool,
    annotations: {
      title: deriveTitle(tool.name),
      ...(readOnly ? { readOnlyHint: true as const } : { destructiveHint: true as const }),
    },
  };
}

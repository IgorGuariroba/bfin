import { z } from "zod";
import type { McpTool } from "../tool-types.js";
import type { ServiceAccount } from "../identity.js";

export function buildWhoami(sa: ServiceAccount): McpTool<Record<string, never>> {
  return {
    name: "mcp_whoami",
    description:
      "Introspect the current MCP service account identity: subject, scopes, actingUserId, tokenExp.",
    // No requiredScope — always listed.
    inputSchema: z.object({}).strict(),
    async handler() {
      return {
        serviceAccount: true,
        subject: sa.subject,
        scopes: [...sa.scopes].sort(),
        actingUserId: sa.actingUserId,
        tokenExp: sa.tokenExp,
      };
    },
  };
}

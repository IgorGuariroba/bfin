#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadMcpConfig } from "../config.js";
import { client as dbClient } from "../db/index.js";
import { loadServiceAccount, ServiceAccountBootstrapError } from "./identity.js";
import { buildToolRegistry } from "./tools/index.js";
import { buildMcpServer } from "./rpc.js";
import { mcpLogger } from "./logger.js";

async function main(): Promise<void> {
  let mcpConfig;
  try {
    mcpConfig = loadMcpConfig();
  } catch (err) {
    mcpLogger.fatal({ err }, "MCP config invalid");
    process.exit(1);
  }

  let sa;
  try {
    sa = await loadServiceAccount({ mcpConfig });
  } catch (err) {
    if (err instanceof ServiceAccountBootstrapError) {
      mcpLogger.fatal({ code: err.code, message: err.message }, "service account bootstrap failed");
    } else {
      mcpLogger.fatal({ err }, "service account bootstrap failed");
    }
    process.exit(1);
  }

  const registry = buildToolRegistry(sa);
  const server = buildMcpServer({ sa, registry, logger: mcpLogger });
  const transport = new StdioServerTransport();

  const shutdown = async (signal: string): Promise<void> => {
    mcpLogger.info({ signal }, "MCP server shutting down");
    try {
      await server.close();
    } catch (err) {
      mcpLogger.error({ err }, "error closing MCP server");
    }
    try {
      await dbClient.end({ timeout: 5 });
    } catch (err) {
      mcpLogger.error({ err }, "error closing db");
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await server.connect(transport);

  mcpLogger.info(
    {
      subject: sa.subject,
      acting_user_id: sa.actingUserId,
      scopes: [...sa.scopes].sort(),
      token_exp: sa.tokenExp,
    },
    "MCP server ready"
  );
}

main().catch((err) => {
  mcpLogger.fatal({ err }, "MCP server unhandled bootstrap error");
  process.exit(1);
});

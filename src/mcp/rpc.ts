import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolResult,
  type ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ZodError } from "zod";
import type { Logger } from "pino";
import {
  AppError,
  ValidationError,
} from "../lib/errors.js";
import { mapDomainError } from "./errors.js";
import { mcpToolCallsTotal, mcpToolDurationSeconds } from "./metrics.js";
import { mcpLogger } from "./logger.js";
import type { ServiceAccount } from "./identity.js";
import type { ToolRegistry, McpToolAny } from "./tool-types.js";
import {
  ToolAuthorizationError,
  authorizeToolCall,
  normalizeRequestedBy,
} from "./authz.js";
import { createInvocationLogger } from "./context.js";

const MCP_SERVER_NAME = "bfin-mcp";
const MCP_SERVER_VERSION = "1.0.0";

export interface BuildMcpServerParams {
  sa: ServiceAccount;
  registry: ToolRegistry;
  logger?: Logger;
}

function toolToDescriptor(tool: McpToolAny): ListToolsResult["tools"][number] {
  const json = z.toJSONSchema(tool.inputSchema, { io: "input" }) as Record<string, unknown>;
  delete json.$schema;
  const inputSchema: ListToolsResult["tools"][number]["inputSchema"] = {
    type: "object",
    ...(json as object),
  };
  inputSchema.type = "object";
  return {
    name: tool.name,
    description: tool.description,
    inputSchema,
  };
}

function textResult(text: string, isError = false): CallToolResult {
  return {
    content: [{ type: "text", text }],
    isError,
  };
}

function mapErrorToResult(err: unknown, logger: Logger): CallToolResult {
  if (err instanceof ToolAuthorizationError) {
    logger.warn({ reason: err.reason }, "tool authorization denied");
    return textResult(
      `[-32003] Unauthorized: ${err.message}`,
      true
    );
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first.path.length > 0 ? first.path.join(".") : "<root>";
    logger.warn({ zodIssue: first }, "tool input validation failed");
    return textResult(`[-32600] Invalid input: ${path}: ${first.message}`, true);
  }
  if (err instanceof ValidationError) {
    logger.warn({ code: err.code }, "tool validation error");
    return textResult(`[-32600] Invalid input: ${err.message}`, true);
  }
  const domain = mapDomainError(err);
  if (domain) {
    logger.warn({ code: domain.code }, "tool domain error");
    return textResult(`[${domain.code}] ${domain.message}`, true);
  }
  logger.error({ err }, "unexpected tool error");
  return textResult("[-32603] Internal error", true);
}

export function buildMcpServer(params: BuildMcpServerParams): Server {
  const { sa, registry } = params;
  const logger = params.logger ?? mcpLogger;

  const server = new Server(
    {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
    {
      capabilities: { tools: {} },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const visible = registry.listVisible(sa.scopes);
    return { tools: visible.map(toolToDescriptor) };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args, _meta } = request.params;
    const startedAt = process.hrtime.bigint();

    const requestedBy = _meta ? normalizeRequestedBy(_meta.requestedBy) : undefined;

    const tool = registry.get(name);
    if (!tool) {
      const invocationLogger = createInvocationLogger(logger, {
        tool: name,
        actingUserId: sa.actingUserId,
        requestedBy,
      });
      invocationLogger.warn("tool not found");
      return textResult(`Tool '${name}' not found`, true);
    }

    const invocationLogger = createInvocationLogger(logger, {
      tool: tool.name,
      scope: tool.requiredScope,
      actingUserId: sa.actingUserId,
      requestedBy,
    });

    const inputHash = createHash("sha256")
      .update(JSON.stringify(args ?? {}))
      .digest("hex")
      .slice(0, 16);

    const auditBase = {
      sub: sa.subject,
      input_hash: inputHash,
    };

    try {
      const parsedInput = tool.inputSchema.parse(args ?? {});

      if (tool.requiredScope !== undefined) {
        await authorizeToolCall(
          sa,
          { requiredScope: tool.requiredScope, minRole: tool.minRole },
          parsedInput
        );
      }

      const result = await tool.handler({
        input: parsedInput,
        actingUserId: sa.actingUserId,
        logger: invocationLogger,
      });

      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      invocationLogger.info(
        { ...auditBase, outcome: "ok", duration_ms: durationMs },
        "tool call succeeded"
      );
      mcpToolCallsTotal.inc({ tool: tool.name, outcome: "ok" });
      mcpToolDurationSeconds.observe({ tool: tool.name }, durationMs / 1000);

      return textResult(JSON.stringify(result));
    } catch (err) {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const mapped = mapErrorToResult(err, invocationLogger);
      mcpToolCallsTotal.inc({ tool: tool.name, outcome: "error" });
      mcpToolDurationSeconds.observe({ tool: tool.name }, durationMs / 1000);
      const errorCode =
        err instanceof AppError ? err.code : undefined;
      invocationLogger.info(
        { ...auditBase, outcome: "error", duration_ms: durationMs, error_code: errorCode },
        "tool call finished with error"
      );
      return mapped;
    }
  });

  return server;
}

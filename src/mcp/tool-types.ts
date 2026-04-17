import type { z } from "zod";
import type { Logger } from "pino";
import type { AccountRole } from "../lib/account-authorization.js";

export interface ToolHandlerContext<TInput> {
  input: TInput;
  actingUserId: string;
  logger: Logger;
}

export interface McpTool<TInput = unknown> {
  name: string;
  description: string;
  requiredScope?: string;
  minRole?: AccountRole;
  inputSchema: z.ZodType<TInput>;
  handler: (ctx: ToolHandlerContext<TInput>) => Promise<unknown>;
}

export type McpToolAny = McpTool<unknown>;

export interface ToolRegistry {
  get(name: string): McpToolAny | undefined;
  listVisible(scopes: ReadonlySet<string>): McpToolAny[];
  all(): McpToolAny[];
}

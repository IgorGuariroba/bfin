import { Counter, Histogram, Gauge, register } from "prom-client";

const PREFIX = "bfin_mcp_";

export const mcpToolCallsTotal = new Counter({
  name: `${PREFIX}tool_calls_total`,
  help: "Total MCP tool calls",
  labelNames: ["tool", "outcome"] as const,
});

export const mcpToolDurationSeconds = new Histogram({
  name: `${PREFIX}tool_duration_seconds`,
  help: "MCP tool call duration in seconds",
  labelNames: ["tool"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const mcpActiveSessions = new Gauge({
  name: `${PREFIX}active_sessions`,
  help: "Currently active MCP sessions",
});

export const mcpAuthFailuresTotal = new Counter({
  name: `${PREFIX}auth_failures_total`,
  help: "Total MCP auth failures",
  labelNames: ["reason"] as const,
});

export function ensureMcpMetricsRegistered(): void {
  // prom-client auto-registers on construction; this function
  // exists so the importing side has an explicit entry point.
  void register;
}

import { Counter, Histogram, Gauge, register } from "prom-client";

const PREFIX = "bfin_mcp_";

function getOrCreateCounter<T extends string>(name: string, help: string, labelNames: T[]) {
  return (register.getSingleMetric(name) as Counter<T> | undefined) ?? new Counter({ name, help, labelNames });
}

function getOrCreateHistogram<T extends string>(name: string, help: string, labelNames: T[], buckets?: number[]) {
  return (register.getSingleMetric(name) as Histogram<T> | undefined) ?? new Histogram({ name, help, labelNames, buckets });
}

function getOrCreateGauge(name: string, help: string) {
  return (register.getSingleMetric(name) as Gauge | undefined) ?? new Gauge({ name, help });
}

export const mcpToolCallsTotal = getOrCreateCounter(
  `${PREFIX}tool_calls_total`,
  "Total MCP tool calls",
  ["tool", "outcome"]
);

export const mcpToolDurationSeconds = getOrCreateHistogram(
  `${PREFIX}tool_duration_seconds`,
  "MCP tool call duration in seconds",
  ["tool"],
  [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
);

export const mcpActiveSessions = getOrCreateGauge(
  `${PREFIX}active_sessions`,
  "Currently active MCP sessions"
);

export const mcpAuthFailuresTotal = getOrCreateCounter(
  `${PREFIX}auth_failures_total`,
  "Total MCP auth failures",
  ["reason"]
);

export function ensureMcpMetricsRegistered(): void {
  // Metrics are created idempotently above; this function
  // exists so the importing side has an explicit entry point.
}

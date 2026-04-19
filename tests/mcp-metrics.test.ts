import { describe, it, expect } from "vitest";

describe("MCP metrics", () => {
  it("ensureMcpMetricsRegistered does not throw", async () => {
    const { ensureMcpMetricsRegistered } = await import("../src/mcp/metrics.js");
    expect(() => ensureMcpMetricsRegistered()).not.toThrow();
  });

  it("mcpToolCallsTotal increments with labels", async () => {
    const { mcpToolCallsTotal } = await import("../src/mcp/metrics.js");
    mcpToolCallsTotal.reset();
    mcpToolCallsTotal.inc({ tool: "test-metrics", outcome: "success" });
    mcpToolCallsTotal.inc({ tool: "test-metrics", outcome: "success" });
    const val = await mcpToolCallsTotal.get();
    const metric = val.values.find(
      (v) => v.labels.tool === "test-metrics" && v.labels.outcome === "success"
    );
    expect(metric?.value).toBe(2);
  });

  it("mcpActiveSessions sets gauge value", async () => {
    const { mcpActiveSessions } = await import("../src/mcp/metrics.js");
    mcpActiveSessions.set(42);
    const val = await mcpActiveSessions.get();
    expect(val.values[0]?.value).toBe(42);
  });

  it("mcpAuthFailuresTotal increments with reason", async () => {
    const { mcpAuthFailuresTotal } = await import("../src/mcp/metrics.js");
    mcpAuthFailuresTotal.reset();
    mcpAuthFailuresTotal.inc({ reason: "test-metrics-reason" });
    const val = await mcpAuthFailuresTotal.get();
    const metric = val.values.find(
      (v) => v.labels.reason === "test-metrics-reason"
    );
    expect(metric?.value).toBe(1);
  });
});

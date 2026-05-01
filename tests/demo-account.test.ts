import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/config.js", () => ({
  config: { demoAccountId: "11111111-1111-4111-8111-111111111111" },
}));

beforeEach(() => {
  vi.resetModules();
});

describe("assertNotDemoAccount", () => {
  it("throws BusinessRuleError when contaId matches demo account", async () => {
    const { assertNotDemoAccount } = await import("../src/lib/demo-account.js");
    const { BusinessRuleError } = await import("../src/lib/errors.js");
    expect(() =>
      assertNotDemoAccount("11111111-1111-4111-8111-111111111111")
    ).toThrow(BusinessRuleError);
    expect(() =>
      assertNotDemoAccount("11111111-1111-4111-8111-111111111111")
    ).toThrow(/demo account/);
  });

  it("does not throw for non-demo account", async () => {
    const { assertNotDemoAccount } = await import("../src/lib/demo-account.js");
    expect(() =>
      assertNotDemoAccount("22222222-2222-4222-8222-222222222222")
    ).not.toThrow();
  });
});

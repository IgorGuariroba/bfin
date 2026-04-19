import { describe, it, expect } from "vitest";
import { mapDomainError } from "../src/mcp/errors.js";
import {
  NotFoundError,
  BusinessRuleError,
  ForbiddenError,
  SystemGeneratedResourceError,
  AppError,
} from "../src/lib/errors.js";

describe("mapDomainError", () => {
  it("maps NotFoundError to -32001", () => {
    const result = mapDomainError(new NotFoundError("X not found"));
    expect(result).toEqual({
      code: -32001,
      message: "X not found",
      data: { type: "not_found" },
    });
  });

  it("maps BusinessRuleError to -32002", () => {
    const result = mapDomainError(new BusinessRuleError("rule broken"));
    expect(result).toEqual({ code: -32002, message: "rule broken" });
  });

  it("maps ForbiddenError to -32003", () => {
    const result = mapDomainError(new ForbiddenError("no access"));
    expect(result).toEqual({ code: -32003, message: "no access" });
  });

  it("maps SystemGeneratedResourceError to -32004", () => {
    const result = mapDomainError(new SystemGeneratedResourceError("system"));
    expect(result).toEqual({ code: -32004, message: "system" });
  });

  it("maps generic AppError to -32602", () => {
    const result = mapDomainError(new AppError("generic err", 500, "INTERNAL_ERROR"));
    expect(result).toEqual({ code: -32602, message: "generic err" });
  });

  it("returns null for non-AppError", () => {
    expect(mapDomainError(new Error("plain"))).toBeNull();
  });

  it("returns null for string", () => {
    expect(mapDomainError("oops")).toBeNull();
  });
});

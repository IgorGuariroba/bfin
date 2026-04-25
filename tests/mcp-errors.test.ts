import { describe, it, expect } from "vitest";
import { toMCPError } from "../src/mcp/errors.js";
import { ZodError } from "zod";
import { z } from "zod";
import {
  NotFoundError,
  BusinessRuleError,
  ForbiddenError,
  SystemGeneratedResourceError,
  AppError,
  DuplicateError,
  AlreadyPaidError,
  DebtHasPaymentsError,
  ValidationError,
} from "../src/lib/errors.js";
import { ToolAuthorizationError } from "../src/mcp/authz.js";

describe("toMCPError", () => {
  it("maps ZodError to INVALID_INPUT with field", () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: "bad" });
    expect(result.success).toBe(false);
    const payload = toMCPError(result.error);
    expect(payload).toEqual({
      code: "INVALID_INPUT",
      message: expect.any(String),
      field: "email",
    });
  });

  it("maps ValidationError to INVALID_INPUT", () => {
    const payload = toMCPError(new ValidationError("bad data"));
    expect(payload).toEqual({ code: "INVALID_INPUT", message: "bad data" });
  });

  it("maps NotFoundError to NOT_FOUND", () => {
    const payload = toMCPError(new NotFoundError("X not found"));
    expect(payload).toEqual({ code: "NOT_FOUND", message: "X not found" });
  });

  it("maps ForbiddenError to FORBIDDEN", () => {
    const payload = toMCPError(new ForbiddenError("no access"));
    expect(payload).toEqual({ code: "FORBIDDEN", message: "no access" });
  });

  it("maps ToolAuthorizationError to FORBIDDEN", () => {
    const payload = toMCPError(new ToolAuthorizationError("denied", "role_check"));
    expect(payload).toEqual({ code: "FORBIDDEN", message: "denied" });
  });

  it("maps BusinessRuleError to BUSINESS_RULE", () => {
    const payload = toMCPError(new BusinessRuleError("rule broken"));
    expect(payload).toEqual({ code: "BUSINESS_RULE", message: "rule broken" });
  });

  it("maps DuplicateError to BUSINESS_RULE with hint", () => {
    const payload = toMCPError(new DuplicateError("dup"));
    expect(payload).toEqual({
      code: "BUSINESS_RULE",
      message: "dup",
      hint: "Resource already exists",
    });
  });

  it("maps SystemGeneratedResourceError to BUSINESS_RULE with hint", () => {
    const payload = toMCPError(new SystemGeneratedResourceError("sys"));
    expect(payload).toEqual({
      code: "BUSINESS_RULE",
      message: "sys",
      hint: "Cannot modify system-generated resource",
    });
  });

  it("maps AlreadyPaidError to BUSINESS_RULE with hint", () => {
    const payload = toMCPError(new AlreadyPaidError("paid"));
    expect(payload).toEqual({
      code: "BUSINESS_RULE",
      message: "paid",
      hint: "Installment already paid",
    });
  });

  it("maps DebtHasPaymentsError to BUSINESS_RULE with hint", () => {
    const payload = toMCPError(new DebtHasPaymentsError("has payments"));
    expect(payload).toEqual({
      code: "BUSINESS_RULE",
      message: "has payments",
      hint: "Cannot delete debt with existing payments",
    });
  });

  it("maps generic AppError to INVALID_INPUT", () => {
    const payload = toMCPError(new AppError("generic", 500, "INTERNAL_ERROR"));
    expect(payload).toEqual({ code: "INVALID_INPUT", message: "generic" });
  });

  it("maps unknown error to INTERNAL", () => {
    const payload = toMCPError(new Error("plain"));
    expect(payload).toEqual({ code: "INTERNAL", message: "Unexpected error" });
  });

  it("maps string to INTERNAL", () => {
    const payload = toMCPError("oops");
    expect(payload).toEqual({ code: "INTERNAL", message: "Unexpected error" });
  });
});

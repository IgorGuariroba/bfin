import { ZodError } from "zod";
import {
  AppError,
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  DuplicateError,
  SystemGeneratedResourceError,
  AlreadyPaidError,
  DebtHasPaymentsError,
} from "../lib/errors.js";
import { ToolAuthorizationError } from "./authz.js";

export type MCPErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "BUSINESS_RULE"
  | "INTERNAL";

export interface MCPErrorPayload {
  code: MCPErrorCode;
  message: string;
  field?: string;
  hint?: string;
}

export function toMCPError(err: unknown): MCPErrorPayload {
  if (err instanceof ToolAuthorizationError) {
    return { code: "FORBIDDEN", message: err.message };
  }

  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first.path.length > 0 ? first.path.join(".") : "<root>";
    return {
      code: "INVALID_INPUT",
      message: first.message,
      field,
    };
  }

  if (err instanceof ValidationError) {
    return { code: "INVALID_INPUT", message: err.message };
  }

  if (err instanceof NotFoundError) {
    return { code: "NOT_FOUND", message: err.message };
  }

  if (err instanceof ForbiddenError) {
    return { code: "FORBIDDEN", message: err.message };
  }

  if (
    err instanceof BusinessRuleError ||
    err instanceof DuplicateError ||
    err instanceof SystemGeneratedResourceError ||
    err instanceof AlreadyPaidError ||
    err instanceof DebtHasPaymentsError
  ) {
    return {
      code: "BUSINESS_RULE",
      message: err.message,
      hint: domainCodeToHint(err.code),
    };
  }

  if (err instanceof AppError) {
    return { code: "INVALID_INPUT", message: err.message };
  }

  return { code: "INTERNAL", message: "Unexpected error" };
}

function domainCodeToHint(
  code: string
): string | undefined {
  switch (code) {
    case "DUPLICATE_RESOURCE":
      return "Resource already exists";
    case "SYSTEM_GENERATED_RESOURCE":
      return "Cannot modify system-generated resource";
    case "ALREADY_PAID":
      return "Installment already paid";
    case "DEBT_HAS_PAYMENTS":
      return "Cannot delete debt with existing payments";
    default:
      return undefined;
  }
}

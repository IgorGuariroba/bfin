import {
  AppError,
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  SystemGeneratedResourceError,
} from "../lib/errors.js";

export interface McpToolError {
  code: number;
  message: string;
  data?: Record<string, unknown>;
}

export function mapDomainError(err: unknown): McpToolError | null {
  if (err instanceof NotFoundError) {
    return { code: -32001, message: err.message, data: { type: "not_found" } };
  }
  if (err instanceof BusinessRuleError) {
    return { code: -32002, message: err.message };
  }
  if (err instanceof ForbiddenError) {
    return { code: -32003, message: err.message };
  }
  if (err instanceof SystemGeneratedResourceError) {
    return { code: -32004, message: err.message };
  }
  if (err instanceof AppError) {
    return { code: -32602, message: err.message };
  }
  return null;
}

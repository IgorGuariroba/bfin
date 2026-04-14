export type ErrorCode =
  | "BUSINESS_RULE_VIOLATION"
  | "INSUFFICIENT_PERMISSIONS"
  | "RESOURCE_NOT_FOUND"
  | "DUPLICATE_RESOURCE"
  | "ALREADY_PAID"
  | "RESOURCE_IN_USE"
  | "SYSTEM_GENERATED_RESOURCE"
  | "DEBT_HAS_PAYMENTS"
  | "CASCADE_DEPTH_EXCEEDED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: ErrorCode
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 422, "BUSINESS_RULE_VIOLATION");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "RESOURCE_NOT_FOUND");
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403, "INSUFFICIENT_PERMISSIONS");
  }
}

export class DuplicateError extends AppError {
  constructor(message: string) {
    super(message, 409, "DUPLICATE_RESOURCE");
  }
}

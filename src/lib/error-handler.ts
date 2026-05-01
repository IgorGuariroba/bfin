import { FastifyInstance, FastifyError } from "fastify";
import { AppError } from "./errors.js";
import { ApiError } from "./schemas.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const timestamp = new Date().toISOString();
    const requestId = request.id;

    let statusCode = 500;
    let code = "INTERNAL_ERROR";
    let message = "Internal server error";

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      code = error.code;
      message = error.message;
    } else if (isValidationError(error)) {
      statusCode = 422;
      code = "VALIDATION_ERROR";
      message = error.message;
    } else if (hasStatusCode(error) && error.statusCode !== 500) {
      statusCode = error.statusCode;
      code = (error as { code?: string }).code ?? "INTERNAL_ERROR";
      message = error.message;
    }

    if (statusCode === 500) {
      request.log.error(error);
    }

    const response: ApiError = {
      timestamp,
      requestId,
      message,
      code,
    };

    void reply.status(statusCode).send(response);
  });
}

function isValidationError(error: unknown): error is FastifyError {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode: number }).statusCode === 400 &&
    "code" in error &&
    (error as { code: string }).code === "FST_ERR_VALIDATION"
  );
}

function hasStatusCode(error: unknown): error is { statusCode: number; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode: number }).statusCode === "number" &&
    "message" in error &&
    typeof (error as { message: string }).message === "string"
  );
}

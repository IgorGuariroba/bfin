import { z, ZodType } from "zod";
import { ValidationError } from "./errors.js";

export const uuidSchema = z.string().uuid();

export function parseOrThrow<T>(schema: ZodType<T>, data: unknown, context?: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.join(".");
    const prefix = context ? `${context}: ` : "";
    const field = path ? `${path} ` : "";
    throw new ValidationError(`${prefix}${field}${first.message}`.trim());
  }
  return result.data;
}

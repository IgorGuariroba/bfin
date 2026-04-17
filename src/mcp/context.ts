import type { Logger } from "pino";

export interface InvocationLoggerFields {
  tool: string;
  scope?: string;
  actingUserId: string;
  requestedBy?: string;
}

export function createInvocationLogger(
  baseLogger: Logger,
  fields: InvocationLoggerFields
): Logger {
  const bindings: Record<string, unknown> = {
    tool: fields.tool,
    acting_user_id: fields.actingUserId,
  };
  if (fields.scope) bindings.scope = fields.scope;
  if (fields.requestedBy) bindings.requested_by = fields.requestedBy;
  return baseLogger.child(bindings);
}

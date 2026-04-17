import { assertAccountRole, type AccountRole } from "../lib/account-authorization.js";
import type { ServiceAccount } from "./identity.js";
import { mcpLogger } from "./logger.js";

export class ToolAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly reason: "scope_missing" | "forbidden"
  ) {
    super(message);
    this.name = "ToolAuthorizationError";
  }
}

export interface ToolAuthzShape {
  requiredScope: string;
  minRole?: AccountRole;
}

export function hasScope(sa: ServiceAccount, requiredScope: string): boolean {
  return sa.scopes.has(requiredScope);
}

export async function authorizeToolCall(
  sa: ServiceAccount,
  tool: ToolAuthzShape,
  input: unknown
): Promise<void> {
  if (!hasScope(sa, tool.requiredScope)) {
    throw new ToolAuthorizationError(
      `Scope '${tool.requiredScope}' is required`,
      "scope_missing"
    );
  }

  if (tool.minRole) {
    const contaId = extractContaId(input);
    if (contaId) {
      await assertAccountRole(sa.actingUserId, contaId, tool.minRole);
    }
  }
}

function extractContaId(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const candidate = (input as { contaId?: unknown }).contaId;
  return typeof candidate === "string" ? candidate : undefined;
}

const MAX_REQUESTED_BY_LEN = 200;
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

export function normalizeRequestedBy(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  if (raw.length === 0 || raw.length > MAX_REQUESTED_BY_LEN) {
    mcpLogger.warn(
      { length: typeof raw === "string" ? raw.length : 0 },
      "discarding meta.requestedBy: invalid length"
    );
    return undefined;
  }
  if (CONTROL_CHARS.test(raw)) {
    mcpLogger.warn("discarding meta.requestedBy: contains control characters");
    return undefined;
  }
  return raw;
}

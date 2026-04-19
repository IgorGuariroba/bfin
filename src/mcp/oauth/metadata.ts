import type { HttpMcpConfig } from "../../config.js";
import type { ToolRegistry } from "../tool-types.js";

type EnabledConfig = Extract<HttpMcpConfig, { enabled: true }>;

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
  scopes_supported: string[];
  resource_documentation?: string;
}

export function collectScopes(registry: ToolRegistry): string[] {
  const seen = new Set<string>();
  for (const tool of registry.all()) {
    if (tool.requiredScope) seen.add(tool.requiredScope);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function buildProtectedResourceMetadata(params: {
  config: EnabledConfig;
  scopes: string[];
}): ProtectedResourceMetadata {
  const { config, scopes } = params;
  return {
    resource: config.baseUrl,
    authorization_servers: [config.authServerUrl],
    bearer_methods_supported: ["header"],
    scopes_supported: scopes,
    resource_documentation: `${config.baseUrl}/docs`,
  };
}

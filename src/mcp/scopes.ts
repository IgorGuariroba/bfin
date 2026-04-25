/**
 * OAuth scope → tool mapping (least-privilege).
 *
 * Each scope grants access to a specific set of read or write tools.
 * Scopes follow the pattern `<resource>:<action>` where action ∈ {read, write, delete}.
 *
 * | Scope                  | Tools                                                        |
 * |------------------------|--------------------------------------------------------------|
 * | accounts:read          | accounts_list, accounts_get                                  |
 * | accounts:write         | accounts_create                                              |
 * | account-members:read   | account-members_list                                         |
 * | account-members:write  | account-members_add                                          |
 * | categories:read        | categories_list                                              |
 * | categories:write       | categories_create                                            |
 * | transactions:read      | transactions_list                                            |
 * | transactions:write     | transactions_create, transactions_update                     |
 * | transactions:delete    | transactions_delete                                          |
 * | debts:read             | debts_list                                                   |
 * | debts:write            | debts_create, debts_pay-installment                          |
 * | goals:read             | goals_list                                                   |
 * | goals:write            | goals_create, goals_update                                   |
 * | daily-limit:read       | daily-limit_get, daily-limit_v2_get                          |
 * | daily-limit:write      | daily-limit_set                                              |
 * | projections:read       | projections_get                                              |
 * | (none)                 | mcp_whoami — always visible                                  |
 *
 * Auth0 tenant must mirror these scopes exactly.
 * See docs/mcp.md for checklist to update Auth0.
 */

export const MCP_SCOPES = [
  "accounts:read",
  "accounts:write",
  "account-members:read",
  "account-members:write",
  "categories:read",
  "categories:write",
  "transactions:read",
  "transactions:write",
  "transactions:delete",
  "debts:read",
  "debts:write",
  "goals:read",
  "goals:write",
  "daily-limit:read",
  "daily-limit:write",
  "projections:read",
] as const;

export type MCPScope = (typeof MCP_SCOPES)[number];

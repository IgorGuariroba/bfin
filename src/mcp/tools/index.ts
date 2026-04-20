import type { McpToolAny, ToolRegistry } from "../tool-types.js";
import type { ServiceAccount } from "../identity.js";
import {
  accountsList,
  accountsGet,
  accountsCreate,
} from "./accounts.js";
import { accountMembersList, accountMembersAdd } from "./account-members.js";
import { categoriesList, categoriesCreate } from "./categories.js";
import {
  transactionsList,
  transactionsCreate,
  transactionsUpdate,
  transactionsDelete,
} from "./transactions.js";
import { debtsList, debtsCreate, debtsPayInstallment } from "./debts.js";
import { goalsList, goalsCreate, goalsUpdate } from "./goals.js";
import { dailyLimitGet, dailyLimitSet } from "./daily-limit.js";
import { projectionsGet } from "./projections.js";
import { buildWhoami } from "./whoami.js";

export function buildToolRegistry(sa: ServiceAccount): ToolRegistry {
  const tools: McpToolAny[] = [
    buildWhoami(sa) as McpToolAny,
    accountsList as McpToolAny,
    accountsGet as McpToolAny,
    accountsCreate as McpToolAny,
    accountMembersList as McpToolAny,
    accountMembersAdd as McpToolAny,
    categoriesList as McpToolAny,
    categoriesCreate as McpToolAny,
    transactionsList as McpToolAny,
    transactionsCreate as McpToolAny,
    transactionsUpdate as McpToolAny,
    transactionsDelete as McpToolAny,
    debtsList as McpToolAny,
    debtsCreate as McpToolAny,
    debtsPayInstallment as McpToolAny,
    goalsList as McpToolAny,
    goalsCreate as McpToolAny,
    goalsUpdate as McpToolAny,
    dailyLimitGet as McpToolAny,
    dailyLimitSet as McpToolAny,
    projectionsGet as McpToolAny,
  ];

  const byName = new Map(tools.map((t) => [t.name, t]));

  return {
    get(name) {
      return byName.get(name);
    },
    listVisible(scopes) {
      return tools.filter(
        (t) => !t.requiredScope || scopes.has(t.requiredScope)
      );
    },
    all() {
      return tools;
    },
  };
}

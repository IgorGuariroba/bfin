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
import { dailyLimitGet, dailyLimitV2Get, dailyLimitSet } from "./daily-limit.js";
import { projectionsGet } from "./projections.js";
import { buildWhoami } from "./whoami.js";
import { withAnnotations } from "./__shared__/annotations.js";

function validateAnnotations(tools: McpToolAny[]): void {
  for (const tool of tools) {
    if (!tool.annotations?.title) {
      throw new Error(
        `Tool '${tool.name}' missing annotation: title is required`
      );
    }
    const hasRead = tool.annotations.readOnlyHint === true;
    const hasDest = tool.annotations.destructiveHint === true;
    if (!hasRead && !hasDest) {
      throw new Error(
        `Tool '${tool.name}' missing annotation: must have readOnlyHint or destructiveHint`
      );
    }
    if (hasRead && hasDest) {
      throw new Error(
        `Tool '${tool.name}' has both readOnlyHint and destructiveHint — must have exactly one`
      );
    }
  }
}

export function buildToolRegistry(sa: ServiceAccount): ToolRegistry {
  const annotated: McpToolAny[] = [
    buildWhoami(sa),
    accountsList,
    accountsGet,
    accountsCreate,
    accountMembersList,
    accountMembersAdd,
    categoriesList,
    categoriesCreate,
    transactionsList,
    transactionsCreate,
    transactionsUpdate,
    transactionsDelete,
    debtsList,
    debtsCreate,
    debtsPayInstallment,
    goalsList,
    goalsCreate,
    goalsUpdate,
    dailyLimitGet,
    dailyLimitV2Get,
    dailyLimitSet,
    projectionsGet,
  ].map((t) => withAnnotations(t as McpToolAny));

  validateAnnotations(annotated);

  const byName = new Map(annotated.map((t) => [t.name, t]));

  return {
    get(name) {
      return byName.get(name);
    },
    listVisible(scopes) {
      return annotated.filter(
        (t) => !t.requiredScope || scopes.has(t.requiredScope)
      );
    },
    all() {
      return annotated;
    },
  };
}

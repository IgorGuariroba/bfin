import { config } from "../config.js";
import { BusinessRuleError } from "./errors.js";

export function assertNotDemoAccount(contaId: string): void {
  if (contaId === config.demoAccountId) {
    throw new BusinessRuleError(
      `Cannot perform write operations on the demo account (${config.demoAccountId})`
    );
  }
}

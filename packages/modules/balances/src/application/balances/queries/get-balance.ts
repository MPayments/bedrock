import { validateBalanceSubject } from "../../../contracts";
import { createZeroBalanceSnapshot } from "../../../domain/balance-position";
import type { BalancesContext } from "../../shared/context";

export function createGetBalanceHandler(context: BalancesContext) {
  return async function getBalance(input: unknown) {
    const subject = validateBalanceSubject(input);

    return (
      (await context.stateRepository.getBalancePosition(subject)) ??
      createZeroBalanceSnapshot(subject)
    );
  };
}

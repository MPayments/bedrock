import { validateBalanceSubject } from "../../../contracts";
import { createZeroBalanceSnapshot } from "../../../domain/balance-position";
import type { BalancesContext } from "../../shared/context";

export function createGetBalanceHandler(context: BalancesContext) {
  return async function getBalance(input: unknown) {
    const subject = validateBalanceSubject(input);
    const repository = context.createStateRepository(context.db);

    return (
      (await repository.getBalancePosition(subject)) ??
      createZeroBalanceSnapshot(subject)
    );
  };
}

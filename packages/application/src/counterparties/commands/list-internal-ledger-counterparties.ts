import type { CounterpartiesServiceContext } from "../internal/context";
import { listInternalLedgerCounterparties } from "../internal-ledger";

export function createListInternalLedgerCounterpartiesHandler(
  context: CounterpartiesServiceContext,
) {
  const { db } = context;

  return async function listInternalLedgerEntities() {
    return listInternalLedgerCounterparties(db);
  };
}

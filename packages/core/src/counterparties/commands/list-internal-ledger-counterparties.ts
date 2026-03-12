import { listInternalLedgerCounterparties } from "../internal-ledger";
import type { CounterpartiesServiceContext } from "../internal/context";

export function createListInternalLedgerCounterpartiesHandler(
  context: CounterpartiesServiceContext,
) {
  const { db } = context;

  return async function listInternalLedgerEntities() {
    return listInternalLedgerCounterparties(db);
  };
}

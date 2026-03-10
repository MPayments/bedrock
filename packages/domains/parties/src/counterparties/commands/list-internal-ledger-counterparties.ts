import type { CounterpartiesServiceContext } from "../internal/context";
import { listInternalLedgerCounterparties as fetchInternalLedgerCounterparties } from "../internal-ledger";

export function createListInternalLedgerCounterpartiesHandler(
  context: CounterpartiesServiceContext,
) {
  const { db } = context;

  return async function listInternalLedgerCounterparties() {
    return fetchInternalLedgerCounterparties(db);
  };
}

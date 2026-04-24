import type { LedgerModule } from "@bedrock/ledger";
import {
  createDrizzleLedgerModule,
  createDrizzleLedgerReadRuntime,
  type CreateDrizzleLedgerModuleInput,
} from "@bedrock/ledger/adapters/drizzle";

import { createWorkerPartiesReadRuntime } from "./parties-module";

export function createWorkerLedgerModule(
  input: Omit<CreateDrizzleLedgerModuleInput, "assertInternalLedgerBooks">,
): LedgerModule {
  const { organizationsQueries } = createWorkerPartiesReadRuntime(input.db);

  return createDrizzleLedgerModule({
    ...input,
    assertInternalLedgerBooks: ({ bookIds }) =>
      organizationsQueries.assertBooksBelongToInternalLedgerOrganizations(
        bookIds,
      ),
  });
}

export const createWorkerLedgerReadRuntime = createDrizzleLedgerReadRuntime;

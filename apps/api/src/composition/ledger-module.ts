import type { LedgerModule } from "@bedrock/ledger";
import {
  createDrizzleLedgerModule,
  createDrizzleLedgerReadRuntime,
  type CreateDrizzleLedgerModuleInput,
} from "@bedrock/ledger/adapters/drizzle";

import { createApiPartiesReadRuntime } from "./parties-module";

export function createApiLedgerModule(
  input: Omit<CreateDrizzleLedgerModuleInput, "assertInternalLedgerBooks">,
): LedgerModule {
  const { organizationsQueries } = createApiPartiesReadRuntime(input.db);

  return createDrizzleLedgerModule({
    ...input,
    assertInternalLedgerBooks: ({ bookIds }) =>
      organizationsQueries.assertBooksBelongToInternalLedgerOrganizations(
        bookIds,
      ),
  });
}

export const createApiLedgerReadRuntime = createDrizzleLedgerReadRuntime;

import type {
  AccountingModule,
  AccountingModuleDeps,
} from "@bedrock/accounting";
import { createDrizzleAccountingModule } from "@bedrock/accounting/adapters/drizzle";
import { createDrizzleDocumentsReadModel } from "@bedrock/documents/read-model";
import type { Logger } from "@bedrock/platform/observability/logger";
import type {
  Database,
  PersistenceContext,
  Transaction,
} from "@bedrock/platform/persistence";

import { createWorkerLedgerReadRuntime } from "./ledger-module";
import { createWorkerPartiesReadRuntime } from "./parties-module";

export function createWorkerAccountingModule(input: {
  db: Database | Transaction;
  persistence: PersistenceContext;
  logger: Logger;
  now?: AccountingModuleDeps["now"];
  generateUuid?: AccountingModuleDeps["generateUuid"];
}): AccountingModule {
  return createDrizzleAccountingModule({
    ...input,
    documentsReadModel: createDrizzleDocumentsReadModel({ db: input.db }),
    ledgerReadRuntime: createWorkerLedgerReadRuntime(input.db),
    partiesReadRuntime: createWorkerPartiesReadRuntime(input.db),
  });
}

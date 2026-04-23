import type {
  AccountingModule,
  AccountingModuleDeps,
} from "@bedrock/accounting";
import { createDrizzleAccountingModule } from "@bedrock/accounting/adapters/drizzle";
import { createDrizzleDocumentsReadModel } from "@bedrock/documents/read-model";
import type { LedgerBookRow } from "@bedrock/ledger/contracts";
import type { Logger } from "@bedrock/platform/observability/logger";
import type {
  Database,
  PersistenceContext,
  Transaction,
} from "@bedrock/platform/persistence";

import { relabelOrganizationBookNames } from "./book-labels";
import { createApiLedgerReadRuntime } from "./ledger-module";
import { createApiPartiesReadRuntime } from "./parties-module";

async function listBooksWithLabels(input: {
  ids: string[];
  listBooksById(ids: string[]): Promise<LedgerBookRow[]>;
  organizationsQueries: {
    listShortNamesById(ids: string[]): Promise<Map<string, string>>;
  };
}) {
  const books = await input.listBooksById(input.ids);
  const ownerIds = Array.from(
    new Set(books.map((book) => book.ownerId).filter(Boolean)),
  ) as string[];
  const organizationShortNamesById =
    ownerIds.length === 0
      ? new Map<string, string>()
      : await input.organizationsQueries.listShortNamesById(ownerIds);

  return relabelOrganizationBookNames({
    books,
    organizationShortNamesById,
  });
}

export function createApiAccountingModule(input: {
  db: Database | Transaction;
  persistence: PersistenceContext;
  logger: Logger;
  now?: AccountingModuleDeps["now"];
  generateUuid?: AccountingModuleDeps["generateUuid"];
}): AccountingModule {
  const partiesReadRuntime = createApiPartiesReadRuntime(input.db);
  const ledgerReadRuntime = createApiLedgerReadRuntime(input.db);
  const documentsReadModel = createDrizzleDocumentsReadModel({ db: input.db });

  return createDrizzleAccountingModule({
    ...input,
    documentsReadModel,
    ledgerReadRuntime,
    partiesReadRuntime,
    listBooksById: (ids) =>
      listBooksWithLabels({
        ids,
        listBooksById: (bookIds) =>
          ledgerReadRuntime.booksQueries.listById(bookIds),
        organizationsQueries: partiesReadRuntime.organizationsQueries,
      }),
  });
}

import { randomUUID } from "node:crypto";

import {
  createAccountingModule,
  type AccountingModule,
  type AccountingModuleDeps,
} from "@bedrock/accounting";
import {
  createAccountingClosePackageSnapshotPort,
  createInMemoryCompiledPackCache,
  DrizzleAccountingUnitOfWork,
  DrizzleChartReads,
  DrizzlePackReads,
  DrizzlePeriodReads,
  DrizzlePeriodRepository,
  DrizzleReportsReads,
} from "@bedrock/accounting/adapters/drizzle";
import { rawPackDefinition } from "@bedrock/accounting/packs/bedrock-core-default";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import { createDrizzleDocumentsReadModel } from "@bedrock/documents/read-model";
import type {
  LedgerBookRow,
  LedgerOperationDetails,
  LedgerOperationList,
  ListLedgerOperationsInput,
  ListScopedPostingRowsInput,
} from "@bedrock/ledger/contracts";
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
  const { booksQueries, operationsQueries, reportsQueries } = ledgerReadRuntime;
  const documentsReadModel = createDrizzleDocumentsReadModel({ db: input.db });
  const ledgerQueries = {
    listBooksById: (ids: string[]) =>
      listBooksWithLabels({
        ids,
        listBooksById: (bookIds) => booksQueries.listById(bookIds),
        organizationsQueries: partiesReadRuntime.organizationsQueries,
      }),
    listBooksByOwnerId: (ownerId: string) =>
      booksQueries.listByOwnerId(ownerId),
    listScopedPostingRows: (query: ListScopedPostingRowsInput) =>
      reportsQueries.listScopedPostingRows(query),
  };
  const ledgerReadPort = {
    listOperations: (
      query?: ListLedgerOperationsInput,
    ): Promise<LedgerOperationList> => operationsQueries.list(query),
    listOperationDetails: (
      operationIds: string[],
    ): Promise<Map<string, LedgerOperationDetails>> =>
      operationsQueries.listDetails(operationIds),
    getOperationDetails: (
      operationId: string,
    ): Promise<LedgerOperationDetails | null> =>
      operationsQueries.getDetails(operationId),
  };
  const currenciesQueries = createCurrenciesQueries({
    db: input.db as Database,
  });
  const reportsReads = new DrizzleReportsReads({
    db: input.db,
    balancesQueries: ledgerReadRuntime.balancesQueries,
    counterpartiesQueries: partiesReadRuntime.counterpartiesQueries,
    customersQueries: partiesReadRuntime.customersQueries,
    documentsPort: documentsReadModel,
    dimensionDocumentsReadModel: documentsReadModel,
    ledgerQueries,
    ledgerReadPort,
    organizationsQueries: partiesReadRuntime.organizationsQueries,
    requisitesQueries: partiesReadRuntime.requisitesQueries,
    listBookNamesById: async (ids) =>
      new Map(
        (await ledgerQueries.listBooksById(ids)).map((row) => [
          row.id,
          row.name ?? row.id,
        ]),
      ),
    listCurrencyPrecisionsByCode: currenciesQueries.listPrecisionsByCode,
  });

  return createAccountingModule({
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    generateUuid: input.generateUuid ?? randomUUID,
    defaultPackDefinition: rawPackDefinition,
    chartReads: new DrizzleChartReads(input.db),
    packReads: new DrizzlePackReads(input.db),
    periodReads: new DrizzlePeriodReads(input.db),
    reportsReads,
    closePackageSnapshotPort: createAccountingClosePackageSnapshotPort({
      repository: new DrizzlePeriodRepository(input.db),
      assertInternalLedgerOrganization:
        partiesReadRuntime.organizationsQueries
          .assertInternalLedgerOrganization,
      listBooksByOwnerId: ledgerQueries.listBooksByOwnerId,
      reportQueries: reportsReads,
      documentsReadModel,
    }),
    internalLedgerOrganizations: partiesReadRuntime.organizationsQueries,
    compiledPackCache: createInMemoryCompiledPackCache(),
    unitOfWork: new DrizzleAccountingUnitOfWork({
      persistence: input.persistence,
    }),
  });
}

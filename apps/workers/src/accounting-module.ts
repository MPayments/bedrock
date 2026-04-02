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
import type { ListScopedPostingRowsInput } from "@bedrock/ledger/contracts";
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
  const partiesReadRuntime = createWorkerPartiesReadRuntime(input.db);
  const ledgerReadRuntime = createWorkerLedgerReadRuntime(input.db);
  const documentsReadModel = createDrizzleDocumentsReadModel({ db: input.db });
  const ledgerQueries = {
    listBooksById: (ids: string[]) => ledgerReadRuntime.booksQueries.listById(ids),
    listBooksByOwnerId: (ownerId: string) =>
      ledgerReadRuntime.booksQueries.listByOwnerId(ownerId),
    listScopedPostingRows: (query: ListScopedPostingRowsInput) =>
      ledgerReadRuntime.reportsQueries.listScopedPostingRows(query),
  };
  const ledgerReadPort = {
    listOperations: (input: Parameters<typeof ledgerReadRuntime.operationsQueries.list>[0]) =>
      ledgerReadRuntime.operationsQueries.list(input),
    listOperationDetails: (
      input: Parameters<typeof ledgerReadRuntime.operationsQueries.listDetails>[0],
    ) => ledgerReadRuntime.operationsQueries.listDetails(input),
    getOperationDetails: (
      input: Parameters<typeof ledgerReadRuntime.operationsQueries.getDetails>[0],
    ) => ledgerReadRuntime.operationsQueries.getDetails(input),
  };
  const currenciesQueries = createCurrenciesQueries({ db: input.db as Database });
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
    listCurrencyPrecisionsByCode: (codes) =>
      currenciesQueries.listPrecisionsByCode(codes),
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
      assertInternalLedgerOrganization: (organizationId) =>
        partiesReadRuntime.organizationsQueries.assertInternalLedgerOrganization(
          organizationId,
        ),
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

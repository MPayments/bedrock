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
import { createBalancesQueries } from "@bedrock/balances/queries";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import { createDrizzleDocumentsReadModel } from "@bedrock/documents/read-model";
import type { LedgerReadService } from "@bedrock/ledger";
import {
  createLedgerQueries,
  type LedgerBookRow,
  type LedgerQueries,
} from "@bedrock/ledger/queries";
import type { Logger } from "@bedrock/platform/observability/logger";
import type {
  Database,
  PersistenceContext,
  Transaction,
} from "@bedrock/platform/persistence";

import { relabelOrganizationBookNames } from "./book-labels";
import { createApiPartiesReadRuntime } from "./parties-module";

async function listBooksWithLabels(input: {
  ids: string[];
  ledgerQueries: Pick<LedgerQueries, "listBooksById">;
  organizationsQueries: {
    listShortNamesById(ids: string[]): Promise<Map<string, string>>;
  };
}): Promise<LedgerBookRow[]> {
  const books = await input.ledgerQueries.listBooksById(input.ids);
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
  ledgerReadPort: LedgerReadService;
  now?: AccountingModuleDeps["now"];
  generateUuid?: AccountingModuleDeps["generateUuid"];
}): AccountingModule {
  const partiesReadRuntime = createApiPartiesReadRuntime(input.db);
  const documentsReadModel = createDrizzleDocumentsReadModel({ db: input.db });
  const rawLedgerQueries = createLedgerQueries({ db: input.db as Database });
  const ledgerQueries: LedgerQueries = {
    ...rawLedgerQueries,
    listBooksById: (ids) =>
      listBooksWithLabels({
        ids,
        ledgerQueries: rawLedgerQueries,
        organizationsQueries: partiesReadRuntime.organizationsQueries,
      }),
  };
  const currenciesQueries = createCurrenciesQueries({ db: input.db as Database });
  const reportsReads = new DrizzleReportsReads({
    db: input.db,
    balancesQueries: createBalancesQueries({ db: input.db as Database }),
    counterpartiesQueries: partiesReadRuntime.counterpartiesQueries,
    customersQueries: partiesReadRuntime.customersQueries,
    documentsPort: documentsReadModel,
    dimensionDocumentsReadModel: documentsReadModel,
    ledgerQueries,
    ledgerReadPort: input.ledgerReadPort,
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
        partiesReadRuntime.organizationsQueries.assertInternalLedgerOrganization,
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

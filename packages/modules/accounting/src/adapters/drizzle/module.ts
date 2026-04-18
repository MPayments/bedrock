import { randomUUID } from "node:crypto";

import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import { createLedgerReadRuntimeFromDrizzle } from "@bedrock/ledger/adapters/drizzle";
import type {
  LedgerBookRow,
  LedgerOperationDetails,
  LedgerOperationList,
  ListLedgerOperationsInput,
  ListScopedPostingRowsInput,
} from "@bedrock/ledger/contracts";
import { createPartiesQueries } from "@bedrock/parties/queries";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";

import { relabelOrganizationBookNames } from "./relabel-organization-book-names";
import { DrizzleChartReads } from "../../chart/adapters/drizzle/chart.reads";
import {
  createAccountingModule,
  type AccountingModule,
  type AccountingModuleDeps,
} from "../../module";
import { createInMemoryCompiledPackCache } from "../../packs/adapters/cache/in-memory-compiled-pack.cache";
import { DrizzlePackReads } from "../../packs/adapters/drizzle/pack.reads";
import { rawPackDefinition } from "../../packs/bedrock-core-default";
import { createAccountingClosePackageSnapshotPort } from "../../periods/adapters/close-package-snapshot.port";
import { DrizzlePeriodReads } from "../../periods/adapters/drizzle/period.reads";
import { DrizzlePeriodRepository } from "../../periods/adapters/drizzle/period.repository";
import { DrizzleReportsReads } from "../../reports/adapters/drizzle/reports.reads";
import { DrizzleAccountingUnitOfWork } from "../../shared/adapters/drizzle/accounting.uow";

export interface AccountingDocumentsReadModel {
  listAdjustmentsForOrganizationPeriod(input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    docTypes: string[];
  }): Promise<
    {
      documentId: string;
      docType: string;
      docNo: string;
      occurredAt: Date;
      title: string;
    }[]
  >;
  listAuditEventsByDocumentId(documentIds: string[]): Promise<
    {
      id: string;
      eventType: string;
      actorId: string | null;
      createdAt: Date;
    }[]
  >;
  listDocumentLabelsById(ids: string[]): Promise<Map<string, string>>;
  listOperationDocumentRefs(operationIds: string[]): Promise<
    Map<
      string,
      {
        operationId: string;
        documentId: string;
        documentType: string;
        channel: string | null;
      }
    >
  >;
}

export interface CreateAccountingModuleFromDrizzleInput {
  db: Database | Transaction;
  documentsReadModel: AccountingDocumentsReadModel;
  generateUuid?: AccountingModuleDeps["generateUuid"];
  logger: Logger;
  now?: AccountingModuleDeps["now"];
  persistence?: PersistenceContext;
}

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

export function createAccountingModuleFromDrizzle(
  input: CreateAccountingModuleFromDrizzleInput,
): AccountingModule {
  const persistence =
    input.persistence ?? createPersistenceContext(input.db as Database);
  const partiesQueries = createPartiesQueries({ db: input.db });
  const ledgerReadRuntime = createLedgerReadRuntimeFromDrizzle(input.db);
  const { balancesQueries, booksQueries, operationsQueries, reportsQueries } =
    ledgerReadRuntime;
  const ledgerQueries = {
    listBooksById: (ids: string[]) =>
      listBooksWithLabels({
        ids,
        listBooksById: (bookIds) => booksQueries.listById(bookIds),
        organizationsQueries: partiesQueries.organizations,
      }),
    listBooksByOwnerId: (ownerId: string) => booksQueries.listByOwnerId(ownerId),
    listScopedPostingRows: (query: ListScopedPostingRowsInput) =>
      reportsQueries.listScopedPostingRows(query),
  };
  const ledgerReadPort = {
    getOperationDetails: (
      operationId: string,
    ): Promise<LedgerOperationDetails | null> =>
      operationsQueries.getDetails(operationId),
    listOperationDetails: (
      operationIds: string[],
    ): Promise<Map<string, LedgerOperationDetails>> =>
      operationsQueries.listDetails(operationIds),
    listOperations: (
      query?: ListLedgerOperationsInput,
    ): Promise<LedgerOperationList> => operationsQueries.list(query),
  };
  const currenciesQueries = createCurrenciesQueries({ db: input.db });
  const reportsReads = new DrizzleReportsReads({
    balancesQueries,
    counterpartiesQueries: partiesQueries.counterparties,
    customersQueries: partiesQueries.customers,
    db: input.db,
    dimensionDocumentsReadModel: input.documentsReadModel,
    documentsPort: input.documentsReadModel,
    ledgerQueries,
    ledgerReadPort,
    listBookNamesById: async (ids) =>
      new Map(
        (await ledgerQueries.listBooksById(ids)).map((row) => [
          row.id,
          row.name ?? row.id,
        ]),
      ),
    listCurrencyPrecisionsByCode: currenciesQueries.listPrecisionsByCode,
    organizationsQueries: partiesQueries.organizations,
    requisitesQueries: partiesQueries.requisites,
  });

  return createAccountingModule({
    chartReads: new DrizzleChartReads(input.db),
    closePackageSnapshotPort: createAccountingClosePackageSnapshotPort({
      assertInternalLedgerOrganization:
        partiesQueries.organizations.assertInternalLedgerOrganization,
      documentsReadModel: input.documentsReadModel,
      listBooksByOwnerId: ledgerQueries.listBooksByOwnerId,
      reportQueries: reportsReads,
      repository: new DrizzlePeriodRepository(input.db),
    }),
    compiledPackCache: createInMemoryCompiledPackCache(),
    defaultPackDefinition: rawPackDefinition,
    generateUuid: input.generateUuid ?? randomUUID,
    internalLedgerOrganizations: partiesQueries.organizations,
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    packReads: new DrizzlePackReads(input.db),
    periodReads: new DrizzlePeriodReads(input.db),
    reportsReads,
    unitOfWork: new DrizzleAccountingUnitOfWork({ persistence }),
  });
}

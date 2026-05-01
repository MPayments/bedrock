import { randomUUID } from "node:crypto";

import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import type {
  LedgerBookRow,
  LedgerOperationDetails,
  LedgerOperationList,
  LedgerScopedPostingRow,
  ListLedgerOperationsInput,
  ListScopedPostingRowsInput,
} from "@bedrock/ledger/contracts";
import type { Logger } from "@bedrock/platform/observability/logger";
import type {
  Database,
  PersistenceContext,
  Transaction,
} from "@bedrock/platform/persistence";

import { DrizzleChartReads } from "../chart/adapters/drizzle/chart.reads";
import {
  createAccountingModule,
  type AccountingModule,
  type AccountingModuleDeps,
} from "../module";
import { createInMemoryCompiledPackCache } from "../packs/adapters/cache/in-memory-compiled-pack.cache";
import { DrizzlePackReads } from "../packs/adapters/drizzle/pack.reads";
import { rawPackDefinition } from "../packs/bedrock-core-default";
import {
  createAccountingClosePackageSnapshotPort,
  type AccountingPeriodsDocumentsReadModel,
} from "../periods/adapters/close-package-snapshot.port";
import { DrizzlePeriodReads } from "../periods/adapters/drizzle/period.reads";
import { DrizzlePeriodRepository } from "../periods/adapters/drizzle/period.repository";
import { DrizzleReportsReads } from "../reports/adapters/drizzle/reports.reads";
import type { DimensionDocumentsReadModel } from "../reports/adapters/reporting/dimensions";
import type {
  AccountingBalancesQueryPort,
  AccountingLedgerQueryPort,
} from "../reports/adapters/reporting/ledger-query.ports";
import type {
  AccountingCounterpartiesQueryPort,
  AccountingCustomersQueryPort,
  AccountingOrganizationsQueryPort,
  AccountingRequisitesQueryPort,
} from "../reports/adapters/reporting/party-query.ports";
import type {
  AccountingReportsDocumentsPort,
  AccountingReportsLedgerPort,
} from "../reports/application/ports";
import { DrizzleAccountingUnitOfWork } from "../shared/adapters/drizzle/accounting.uow";

export { DrizzleChartReads } from "../chart/adapters/drizzle/chart.reads";
export { DrizzleChartStore } from "../chart/adapters/drizzle/chart.store";
export {
  createInMemoryCompiledPackCache,
  InMemoryCompiledPackCache,
} from "../packs/adapters/cache/in-memory-compiled-pack.cache";
export { DrizzlePackReads } from "../packs/adapters/drizzle/pack.reads";
export { DrizzlePackRepository } from "../packs/adapters/drizzle/pack.repository";
export { createAccountingClosePackageSnapshotPort } from "../periods/adapters/close-package-snapshot.port";
export type { AccountingPeriodsDocumentsReadModel } from "../periods/adapters/close-package-snapshot.port";
export { DrizzlePeriodReads } from "../periods/adapters/drizzle/period.reads";
export { DrizzlePeriodRepository } from "../periods/adapters/drizzle/period.repository";
export { DrizzleReportsReads } from "../reports/adapters/drizzle/reports.reads";
export { DrizzleReportsRepository } from "../reports/adapters/drizzle/reports.repository";
export { DrizzleAccountingUnitOfWork } from "../shared/adapters/drizzle/accounting.uow";

export interface DrizzleAccountingLedgerReadRuntime {
  balancesQueries: AccountingBalancesQueryPort;
  booksQueries: {
    listById(ids: string[]): Promise<LedgerBookRow[]>;
    listByOwnerId(ownerId: string): Promise<{ id: string }[]>;
  };
  operationsQueries: {
    list(query?: ListLedgerOperationsInput): Promise<LedgerOperationList>;
    listDetails(
      operationIds: string[],
    ): Promise<Map<string, LedgerOperationDetails>>;
    getDetails(operationId: string): Promise<LedgerOperationDetails | null>;
  };
  reportsQueries: {
    listScopedPostingRows(
      query: ListScopedPostingRowsInput,
    ): Promise<LedgerScopedPostingRow[]>;
  };
}

export interface DrizzleAccountingPartiesReadRuntime {
  counterpartiesQueries: AccountingCounterpartiesQueryPort;
  customersQueries: AccountingCustomersQueryPort;
  organizationsQueries: AccountingOrganizationsQueryPort;
  requisitesQueries: AccountingRequisitesQueryPort;
}

export interface CreateDrizzleAccountingModuleInput {
  db: Database | Transaction;
  persistence: PersistenceContext;
  logger: Logger;
  documentsReadModel: AccountingReportsDocumentsPort &
    DimensionDocumentsReadModel &
    AccountingPeriodsDocumentsReadModel;
  ledgerReadRuntime: DrizzleAccountingLedgerReadRuntime;
  partiesReadRuntime: DrizzleAccountingPartiesReadRuntime;
  listBooksById?: (ids: string[]) => Promise<LedgerBookRow[]>;
  now?: AccountingModuleDeps["now"];
  generateUuid?: AccountingModuleDeps["generateUuid"];
}

export function bindAssertInternalLedgerOrganization(
  organizationsQueries: DrizzleAccountingPartiesReadRuntime["organizationsQueries"],
) {
  return (organizationId: string) =>
    organizationsQueries.assertInternalLedgerOrganization(organizationId);
}

export function bindListBooksByOwnerId(
  booksQueries: DrizzleAccountingLedgerReadRuntime["booksQueries"],
) {
  return (organizationId: string) => booksQueries.listByOwnerId(organizationId);
}

export function createDrizzleAccountingModule(
  input: CreateDrizzleAccountingModuleInput,
): AccountingModule {
  const { ledgerReadRuntime, partiesReadRuntime } = input;
  const listBooksById =
    input.listBooksById ??
    ((ids: string[]) => ledgerReadRuntime.booksQueries.listById(ids));
  const ledgerQueries: AccountingLedgerQueryPort = {
    listBooksById,
    listScopedPostingRows: (query) =>
      ledgerReadRuntime.reportsQueries.listScopedPostingRows(query),
  };
  const ledgerReadPort: AccountingReportsLedgerPort = {
    listOperations: (query) => ledgerReadRuntime.operationsQueries.list(query),
    listOperationDetails: (operationIds) =>
      ledgerReadRuntime.operationsQueries.listDetails(operationIds),
    getOperationDetails: (operationId) =>
      ledgerReadRuntime.operationsQueries.getDetails(operationId),
  };
  const currenciesQueries = createCurrenciesQueries({
    db: input.db as Database,
  });
  const reportsReads = new DrizzleReportsReads({
    db: input.db,
    balancesQueries: ledgerReadRuntime.balancesQueries,
    counterpartiesQueries: partiesReadRuntime.counterpartiesQueries,
    customersQueries: partiesReadRuntime.customersQueries,
    documentsPort: input.documentsReadModel,
    dimensionDocumentsReadModel: input.documentsReadModel,
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
      assertInternalLedgerOrganization: bindAssertInternalLedgerOrganization(
        partiesReadRuntime.organizationsQueries,
      ),
      listBooksByOwnerId: bindListBooksByOwnerId(
        ledgerReadRuntime.booksQueries,
      ),
      reportQueries: reportsReads,
      documentsReadModel: input.documentsReadModel,
    }),
    internalLedgerOrganizations: partiesReadRuntime.organizationsQueries,
    compiledPackCache: createInMemoryCompiledPackCache(),
    unitOfWork: new DrizzleAccountingUnitOfWork({
      persistence: input.persistence,
    }),
  });
}

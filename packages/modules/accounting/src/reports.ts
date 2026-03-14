export * from "./contracts/reporting";
import { createBalancesQueries } from "@bedrock/balances/queries";
import { createCounterpartiesQueries } from "@bedrock/counterparties/queries";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import { createCustomersQueries } from "@bedrock/customers/queries";
import type { LedgerReadService } from "@bedrock/ledger";
import { createLedgerQueries } from "@bedrock/ledger/queries";
import { createOrganizationsQueries } from "@bedrock/organizations/queries";
import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";
import { createRequisitesQueries } from "@bedrock/requisites/queries";

import {
  createAccountingReportQueriesService,
} from "./application/reports/report-service";
import {
  createAccountingReportsService as createAccountingReportsApplicationService,
  type AccountingReportsService,
} from "./application/reports/service";
import { createDrizzleAccountingReportsRepository } from "./infra/drizzle/repos/reports-repository";
import { createBedrockDimensionRegistry } from "./infra/reporting/dimensions";
import { createReportsScopeHelpers } from "./infra/reporting/query-support/scope";
import { createReportsSharedHelpers } from "./infra/reporting/query-support/shared";

export { type AccountingReportsService };

export interface AccountingReportsDocumentsQueries {
  listDocumentLabelsById: (ids: string[]) => Promise<Map<string, string>>;
}

export interface AccountingReportsServiceDeps {
  db: Database;
  ledgerReadService?: Pick<
    LedgerReadService,
    "getOperationDetails" | "listOperations"
  >;
  documentsQueries?: AccountingReportsDocumentsQueries;
  logger?: Logger;
}

export function createAccountingReportsService(
  deps: AccountingReportsServiceDeps,
): AccountingReportsService {
  const { db, documentsQueries } = deps;

  const balancesQueries = createBalancesQueries({ db });
  const counterpartiesQueries = createCounterpartiesQueries({ db });
  const currenciesQueries = createCurrenciesQueries({ db });
  const customersQueries = createCustomersQueries({ db });
  const ledgerQueries = createLedgerQueries({ db });
  const organizationsQueries = createOrganizationsQueries({ db });
  const requisitesQueries = createRequisitesQueries({ db });
  const reportsRepository = createDrizzleAccountingReportsRepository(db);
  const dimensionRegistry = createBedrockDimensionRegistry({
    counterpartiesQueries,
    customersQueries,
    requisitesQueries,
    documentsQueries,
  });

  const reportContext = {
    ...createReportsSharedHelpers({
      balancesQueries,
      counterpartiesQueries,
      organizationsQueries,
      reportsRepository,
    }),
    ...createReportsScopeHelpers({
      counterpartiesQueries,
      ledgerQueries,
      organizationsQueries,
    }),
    assertInternalOrganization: organizationsQueries.assertInternalLedgerOrganization,
  };

  const reportQueries = createAccountingReportQueriesService({
    context: reportContext,
  });

  return createAccountingReportsApplicationService({
    ledgerReadService: deps.ledgerReadService ?? ledgerQueries,
    listBookNamesById: async (ids) =>
      new Map(
        (await ledgerQueries.listBooksById(ids)).map((row) => [
          row.id,
          row.name ?? row.id,
        ]),
      ),
    listCurrencyPrecisionsByCode: currenciesQueries.listPrecisionsByCode,
    resolveDimensionLabelsFromRecords:
      dimensionRegistry.resolveLabelsFromDimensionRecords,
    reportQueries,
  });
}

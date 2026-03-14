export * from "./contracts/reports/dto";
export * from "./contracts/reports/queries";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import { createCustomersQueries } from "@bedrock/customers/queries";
import type { LedgerReadService } from "@bedrock/ledger";
import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";
import { createRequisitesQueries } from "@bedrock/requisites/queries";

import {
  createAccountingReportsHandlers,
  type AccountingReportsService,
} from "./application/reports";
import { createBedrockDimensionRegistry } from "./infra/reporting/dimensions";
import { createAccountingReportingRuntime } from "./reporting-runtime";

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

  const currenciesQueries = createCurrenciesQueries({ db });
  const customersQueries = createCustomersQueries({ db });
  const requisitesQueries = createRequisitesQueries({ db });
  const { counterpartiesQueries, ledgerQueries, reportQueries } =
    createAccountingReportingRuntime({ db });
  const dimensionRegistry = createBedrockDimensionRegistry({
    counterpartiesQueries,
    customersQueries,
    requisitesQueries,
    documentsQueries,
  });

  return createAccountingReportsHandlers({
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

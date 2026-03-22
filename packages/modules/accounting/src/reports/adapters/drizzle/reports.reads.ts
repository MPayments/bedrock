import type { BalancesQueries } from "@bedrock/balances/queries";
import type { LedgerQueries } from "@bedrock/ledger/queries";
import type { Queryable } from "@bedrock/platform/persistence";

import type {
  AccountingReportsDocumentsPort,
  AccountingReportsLedgerPort,
  AccountingReportsServicePorts,
} from "../../application/ports";
import type { ReportsReads } from "../../application/ports/reports.reads";
import {
  createGetOperationDetailsWithLabelsQuery,
  type LedgerOperationDetailsWithLabels,
} from "../../application/queries/get-operation-details-with-labels";
import { createListOperationDetailsWithLabelsQuery } from "../../application/queries/list-operation-details-with-labels";
import {
  createListOperationsWithLabelsQuery,
  type LedgerOperationListWithLabels,
} from "../../application/queries/list-operations-with-labels";
import {
  createAccountingReportQueries,
  type AccountingReportQueries,
} from "../../application/queries/reports";
import { createAccountingReportsContext } from "../reporting/context";
import {
  createBedrockDimensionRegistry,
  type DimensionDocumentsReadModel,
} from "../reporting/dimensions";
import type {
  AccountingCounterpartiesQueryPort,
  AccountingCustomersQueryPort,
  AccountingOrganizationsQueryPort,
  AccountingRequisitesQueryPort,
} from "../reporting/party-query-ports";
import { DrizzleReportsRepository } from "./reports.repository";

export class DrizzleReportsReads implements ReportsReads {
  private readonly reportQueries: AccountingReportQueries;
  private readonly getOperationDetailsQuery: (
    operationId: string,
  ) => Promise<LedgerOperationDetailsWithLabels | null>;
  private readonly listOperationDetailsQuery: (
    operationIds: string[],
  ) => Promise<Map<string, LedgerOperationDetailsWithLabels>>;
  private readonly listOperationsQuery: (
    query?: Parameters<AccountingReportsLedgerPort["listOperations"]>[0],
  ) => Promise<LedgerOperationListWithLabels>;

  constructor(input: {
    db: Queryable;
    balancesQueries: BalancesQueries;
    counterpartiesQueries: AccountingCounterpartiesQueryPort;
    customersQueries: AccountingCustomersQueryPort;
    documentsPort: AccountingReportsDocumentsPort;
    dimensionDocumentsReadModel?: DimensionDocumentsReadModel;
    ledgerQueries: LedgerQueries;
    ledgerReadPort: AccountingReportsLedgerPort;
    organizationsQueries: AccountingOrganizationsQueryPort;
    requisitesQueries: AccountingRequisitesQueryPort;
    listBookNamesById: AccountingReportsServicePorts["listBookNamesById"];
    listCurrencyPrecisionsByCode: AccountingReportsServicePorts["listCurrencyPrecisionsByCode"];
    resolveDimensionLabelsFromRecords?: AccountingReportsServicePorts["resolveDimensionLabelsFromRecords"];
  }) {
    const dimensionRegistry = createBedrockDimensionRegistry({
      counterpartiesQueries: input.counterpartiesQueries,
      customersQueries: input.customersQueries,
      organizationsQueries: input.organizationsQueries,
      requisitesQueries: input.requisitesQueries,
      documentsReadModel: input.dimensionDocumentsReadModel,
    });
    const context = createAccountingReportsContext({
      balancesQueries: input.balancesQueries,
      counterpartiesQueries: input.counterpartiesQueries,
      documentsPort: input.documentsPort,
      ledgerQueries: input.ledgerQueries,
      organizationsQueries: input.organizationsQueries,
      reportsRepository: new DrizzleReportsRepository(input.db),
    });

    this.reportQueries = createAccountingReportQueries({
      context,
    });
    this.getOperationDetailsQuery = createGetOperationDetailsWithLabelsQuery({
      ledgerReadPort: input.ledgerReadPort,
      listBookNamesById: input.listBookNamesById,
      listCurrencyPrecisionsByCode: input.listCurrencyPrecisionsByCode,
      resolveDimensionLabelsFromRecords:
        input.resolveDimensionLabelsFromRecords ??
        dimensionRegistry.resolveLabelsFromDimensionRecords,
    });
    this.listOperationDetailsQuery = createListOperationDetailsWithLabelsQuery({
      ledgerReadPort: input.ledgerReadPort,
      listBookNamesById: input.listBookNamesById,
      listCurrencyPrecisionsByCode: input.listCurrencyPrecisionsByCode,
      resolveDimensionLabelsFromRecords:
        input.resolveDimensionLabelsFromRecords ??
        dimensionRegistry.resolveLabelsFromDimensionRecords,
    });
    this.listOperationsQuery = createListOperationsWithLabelsQuery({
      ledgerReadPort: input.ledgerReadPort,
      listBookNamesById: input.listBookNamesById,
    });
  }

  getOperationDetailsWithLabels(operationId: string) {
    return this.getOperationDetailsQuery(operationId);
  }

  listOperationDetailsWithLabels(operationIds: string[]) {
    return this.listOperationDetailsQuery(operationIds);
  }

  listOperationsWithLabels(
    query?: Parameters<AccountingReportsLedgerPort["listOperations"]>[0],
  ) {
    return this.listOperationsQuery(query);
  }

  listTrialBalance(
    ...args: Parameters<AccountingReportQueries["listTrialBalance"]>
  ) {
    return this.reportQueries.listTrialBalance(...args);
  }

  listGeneralLedger(
    ...args: Parameters<AccountingReportQueries["listGeneralLedger"]>
  ) {
    return this.reportQueries.listGeneralLedger(...args);
  }

  listBalanceSheet(
    ...args: Parameters<AccountingReportQueries["listBalanceSheet"]>
  ) {
    return this.reportQueries.listBalanceSheet(...args);
  }

  listIncomeStatement(
    ...args: Parameters<AccountingReportQueries["listIncomeStatement"]>
  ) {
    return this.reportQueries.listIncomeStatement(...args);
  }

  listCashFlow(...args: Parameters<AccountingReportQueries["listCashFlow"]>) {
    return this.reportQueries.listCashFlow(...args);
  }

  listLiquidity(...args: Parameters<AccountingReportQueries["listLiquidity"]>) {
    return this.reportQueries.listLiquidity(...args);
  }

  listFxRevaluation(
    ...args: Parameters<AccountingReportQueries["listFxRevaluation"]>
  ) {
    return this.reportQueries.listFxRevaluation(...args);
  }

  listFeeRevenue(
    ...args: Parameters<AccountingReportQueries["listFeeRevenue"]>
  ) {
    return this.reportQueries.listFeeRevenue(...args);
  }

  listFeeRevenueBreakdown(
    ...args: Parameters<AccountingReportQueries["listFeeRevenueBreakdown"]>
  ) {
    return this.reportQueries.listFeeRevenueBreakdown(...args);
  }

  listClosePackage(
    ...args: Parameters<AccountingReportQueries["listClosePackage"]>
  ) {
    return this.reportQueries.listClosePackage(...args);
  }
}

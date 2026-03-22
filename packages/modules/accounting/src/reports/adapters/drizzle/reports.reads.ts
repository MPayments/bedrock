import type { BalancesQueries } from "@bedrock/balances/queries";
import type { ListLedgerOperationsInput } from "@bedrock/ledger/contracts";
import type { LedgerQueries } from "@bedrock/ledger/queries";
import type { Queryable } from "@bedrock/platform/persistence";

import { DrizzleReportsRepository } from "./reports.repository";
import type {
  BalanceSheetQuery,
  CashFlowQuery,
  ClosePackageQuery,
  FeeRevenueQuery,
  FxRevaluationQuery,
  GeneralLedgerQuery,
  IncomeStatementQuery,
  LiquidityQuery,
  TrialBalanceQuery,
} from "../../application/contracts/queries";
import type {
  AccountingReportsDocumentsPort,
  AccountingReportsServicePorts,
} from "../../application/ports";
import type { AccountingReportsLedgerPort } from "../../application/ports";
import type { ReportsReads } from "../../application/ports/reports.reads";
import { type LedgerOperationDetailsWithLabels } from "../../application/queries/get-operation-details-with-labels";
import { ListOperationDetailsWithLabelsReadQuery } from "../../application/queries/list-operation-details-with-labels";
import {
  type LedgerOperationListWithLabels,
  ListOperationsWithLabelsReadQuery,
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

export class DrizzleReportsReads implements ReportsReads {
  private readonly reportQueries: AccountingReportQueries;
  private readonly listOperationDetailsQuery: (
    operationIds: string[],
  ) => Promise<Map<string, LedgerOperationDetailsWithLabels>>;
  private readonly listOperationsQuery: (
    query?: ListLedgerOperationsInput,
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
    const listOperationDetailsQuery = new ListOperationDetailsWithLabelsReadQuery(
      {
        ledgerReadPort: input.ledgerReadPort,
        listBookNamesById: input.listBookNamesById,
        listCurrencyPrecisionsByCode: input.listCurrencyPrecisionsByCode,
        resolveDimensionLabelsFromRecords:
          input.resolveDimensionLabelsFromRecords ??
          dimensionRegistry.resolveLabelsFromDimensionRecords,
      },
    );
    const listOperationsQuery = new ListOperationsWithLabelsReadQuery({
      ledgerReadPort: input.ledgerReadPort,
      listBookNamesById: input.listBookNamesById,
    });

    this.listOperationDetailsQuery =
      listOperationDetailsQuery.execute.bind(listOperationDetailsQuery);
    this.listOperationsQuery =
      listOperationsQuery.execute.bind(listOperationsQuery);
  }

  async getOperationDetailsWithLabels(operationId: string) {
    return (
      (await this.listOperationDetailsQuery([operationId])).get(operationId) ??
      null
    );
  }

  listOperationDetailsWithLabels(operationIds: string[]) {
    return this.listOperationDetailsQuery(operationIds);
  }

  listOperationsWithLabels(
    query?: ListLedgerOperationsInput,
  ) {
    return this.listOperationsQuery(query);
  }

  listTrialBalance(query?: TrialBalanceQuery) {
    return this.reportQueries.listTrialBalance(query);
  }

  listGeneralLedger(query?: GeneralLedgerQuery) {
    return this.reportQueries.listGeneralLedger(query);
  }

  listBalanceSheet(query?: BalanceSheetQuery) {
    return this.reportQueries.listBalanceSheet(query);
  }

  listIncomeStatement(query?: IncomeStatementQuery) {
    return this.reportQueries.listIncomeStatement(query);
  }

  listCashFlow(query?: CashFlowQuery) {
    return this.reportQueries.listCashFlow(query);
  }

  listLiquidity(query?: LiquidityQuery) {
    return this.reportQueries.listLiquidity(query);
  }

  listFxRevaluation(query?: FxRevaluationQuery) {
    return this.reportQueries.listFxRevaluation(query);
  }

  listFeeRevenue(query?: FeeRevenueQuery) {
    return this.reportQueries.listFeeRevenue(query);
  }

  listFeeRevenueBreakdown(query?: FeeRevenueQuery) {
    return this.reportQueries.listFeeRevenueBreakdown(query);
  }

  listClosePackage(query?: ClosePackageQuery) {
    return this.reportQueries.listClosePackage(query);
  }
}

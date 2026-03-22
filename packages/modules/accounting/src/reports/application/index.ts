import { GetOperationDetailsWithLabelsQuery } from "./queries/get-operation-details-with-labels.query";
import { ListOperationDetailsWithLabelsQuery } from "./queries/list-operation-details-with-labels.query";
import { ListOperationsWithLabelsQuery } from "./queries/list-operations-with-labels.query";
import type { ReportsReads } from "./ports/reports.reads";
import { ListBalanceSheetQuery } from "./queries/reports/list-balance-sheet.query";
import { ListCashFlowQuery } from "./queries/reports/list-cash-flow.query";
import { ListClosePackageQuery } from "./queries/reports/list-close-package.query";
import { ListFeeRevenueBreakdownQuery } from "./queries/reports/list-fee-revenue-breakdown.query";
import { ListFeeRevenueQuery } from "./queries/reports/list-fee-revenue.query";
import { ListFxRevaluationQuery } from "./queries/reports/list-fx-revaluation.query";
import { ListGeneralLedgerQuery } from "./queries/reports/list-general-ledger.query";
import { ListIncomeStatementQuery } from "./queries/reports/list-income-statement.query";
import { ListLiquidityQuery } from "./queries/reports/list-liquidity.query";
import { ListTrialBalanceQuery } from "./queries/reports/list-trial-balance.query";

export interface ReportsServiceDeps {
  reads: ReportsReads;
}

export function createReportsService({ reads }: ReportsServiceDeps) {
  const getOperationDetailsWithLabels = new GetOperationDetailsWithLabelsQuery(
    reads,
  );
  const listOperationDetailsWithLabels =
    new ListOperationDetailsWithLabelsQuery(reads);
  const listOperationsWithLabels = new ListOperationsWithLabelsQuery(reads);
  const listTrialBalance = new ListTrialBalanceQuery(reads);
  const listGeneralLedger = new ListGeneralLedgerQuery(reads);
  const listBalanceSheet = new ListBalanceSheetQuery(reads);
  const listIncomeStatement = new ListIncomeStatementQuery(reads);
  const listCashFlow = new ListCashFlowQuery(reads);
  const listLiquidity = new ListLiquidityQuery(reads);
  const listFxRevaluation = new ListFxRevaluationQuery(reads);
  const listFeeRevenue = new ListFeeRevenueQuery(reads);
  const listFeeRevenueBreakdown = new ListFeeRevenueBreakdownQuery(reads);
  const listClosePackage = new ListClosePackageQuery(reads);

  return {
    queries: {
      getOperationDetailsWithLabels:
        getOperationDetailsWithLabels.execute.bind(getOperationDetailsWithLabels),
      listOperationDetailsWithLabels:
        listOperationDetailsWithLabels.execute.bind(
          listOperationDetailsWithLabels,
        ),
      listOperationsWithLabels:
        listOperationsWithLabels.execute.bind(listOperationsWithLabels),
      listTrialBalance: listTrialBalance.execute.bind(listTrialBalance),
      listGeneralLedger: listGeneralLedger.execute.bind(listGeneralLedger),
      listBalanceSheet: listBalanceSheet.execute.bind(listBalanceSheet),
      listIncomeStatement:
        listIncomeStatement.execute.bind(listIncomeStatement),
      listCashFlow: listCashFlow.execute.bind(listCashFlow),
      listLiquidity: listLiquidity.execute.bind(listLiquidity),
      listFxRevaluation: listFxRevaluation.execute.bind(listFxRevaluation),
      listFeeRevenue: listFeeRevenue.execute.bind(listFeeRevenue),
      listFeeRevenueBreakdown:
        listFeeRevenueBreakdown.execute.bind(listFeeRevenueBreakdown),
      listClosePackage: listClosePackage.execute.bind(listClosePackage),
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;

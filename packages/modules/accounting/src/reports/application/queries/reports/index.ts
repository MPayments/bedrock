import { ListBalanceSheetReportQuery } from "./balance-sheet";
import { ListCashFlowReportQuery } from "./cash-flow";
import { ListClosePackageReportQuery } from "./close-package";
import { ListFeeRevenueReportQuery } from "./fee-revenue";
import { ListFxRevaluationReportQuery } from "./fx-revaluation";
import { ListGeneralLedgerReportQuery } from "./general-ledger";
import {
  ComputeIncomeStatementCoreQuery,
  ListIncomeStatementReportQuery,
} from "./income-statement";
import { ListLiquidityReportQuery } from "./liquidity";
import { ListTrialBalanceReportQuery } from "./trial-balance";
import type { AccountingReportsContext } from "../../ports";

export type {
  BalanceSheetCheck,
  BalanceSheetRow,
  CashFlowRow,
  CashFlowSummaryByCurrency,
  ClosePackageAdjustment,
  ClosePackageAuditEvent,
  ClosePackageResult,
  FeeRevenueRow,
  FeeRevenueSummaryByCurrency,
  FinancialResultStatus,
  FxRevaluationRow,
  FxRevaluationSummaryByCurrency,
  GeneralLedgerBalance,
  GeneralLedgerEntry,
  IncomeStatementRow,
  IncomeStatementSummaryByCurrency,
  ReportScopeMeta,
  TrialBalanceRow,
  TrialBalanceSummaryByCurrency,
} from "./types";

export function createAccountingReportQueries(input: {
  context: AccountingReportsContext;
}) {
  const { context } = input;

  const listTrialBalance = new ListTrialBalanceReportQuery(context);
  const listGeneralLedger = new ListGeneralLedgerReportQuery(context);
  const listBalanceSheet = new ListBalanceSheetReportQuery(context);
  const computeIncomeStatementCore = new ComputeIncomeStatementCoreQuery(
    context,
  );
  const listIncomeStatement = new ListIncomeStatementReportQuery(
    computeIncomeStatementCore,
  );
  const listCashFlow = new ListCashFlowReportQuery({
    context,
    computeIncomeStatementCore,
  });
  const listLiquidity = new ListLiquidityReportQuery(context);
  const listFxRevaluation = new ListFxRevaluationReportQuery(context);
  const listFeeRevenue = new ListFeeRevenueReportQuery(context);
  const listClosePackage = new ListClosePackageReportQuery(context);

  return {
    listTrialBalance: listTrialBalance.execute.bind(listTrialBalance),
    listGeneralLedger: listGeneralLedger.execute.bind(listGeneralLedger),
    listBalanceSheet: listBalanceSheet.execute.bind(listBalanceSheet),
    listIncomeStatement: listIncomeStatement.execute.bind(listIncomeStatement),
    listCashFlow: listCashFlow.execute.bind(listCashFlow),
    listLiquidity: listLiquidity.execute.bind(listLiquidity),
    listFxRevaluation: listFxRevaluation.execute.bind(listFxRevaluation),
    listFeeRevenue: listFeeRevenue.execute.bind(listFeeRevenue),
    listFeeRevenueBreakdown: listFeeRevenue.execute.bind(listFeeRevenue),
    listClosePackage: listClosePackage.execute.bind(listClosePackage),
  };
}

export type AccountingReportQueries = ReturnType<typeof createAccountingReportQueries>;

import { createListBalanceSheetHandler } from "./balance-sheet";
import { createListCashFlowHandler } from "./cash-flow";
import { createListClosePackageHandler } from "./close-package";
import { createListFeeRevenueHandler } from "./fee-revenue";
import { createListFxRevaluationHandler } from "./fx-revaluation";
import { createListGeneralLedgerHandler } from "./general-ledger";
import {
  createComputeIncomeStatementCoreHandler,
  createListIncomeStatementHandler,
} from "./income-statement";
import { createListLiquidityHandler } from "./liquidity";
import { createListTrialBalanceHandler } from "./trial-balance";
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

  const listTrialBalance = createListTrialBalanceHandler(context);
  const listGeneralLedger = createListGeneralLedgerHandler(context);
  const listBalanceSheet = createListBalanceSheetHandler(context);
  const computeIncomeStatementCore = createComputeIncomeStatementCoreHandler(context);
  const listIncomeStatement = createListIncomeStatementHandler({
    computeIncomeStatementCore,
  });
  const listCashFlow = createListCashFlowHandler({
    context,
    computeIncomeStatementCore,
  });
  const listLiquidity = createListLiquidityHandler(context);
  const listFxRevaluation = createListFxRevaluationHandler(context);
  const listFeeRevenue = createListFeeRevenueHandler(context);
  const listClosePackage = createListClosePackageHandler(context);

  async function listFeeRevenueBreakdown(
    ...args: Parameters<typeof listFeeRevenue>
  ) {
    return listFeeRevenue(...args);
  }

  return {
    listTrialBalance,
    listGeneralLedger,
    listBalanceSheet,
    listIncomeStatement,
    listCashFlow,
    listLiquidity,
    listFxRevaluation,
    listFeeRevenue,
    listFeeRevenueBreakdown,
    listClosePackage,
  };
}

export type AccountingReportQueries = ReturnType<typeof createAccountingReportQueries>;

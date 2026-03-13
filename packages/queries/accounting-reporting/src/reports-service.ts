import type { AccountingReportingServiceDeps } from "./internal/context";
import { createReportsScopeHelpers } from "./internal/scope";
import { createReportsSharedHelpers } from "./internal/shared";
import { createListBalanceSheetHandler } from "./reports/balance-sheet";
import { createListCashFlowHandler } from "./reports/cash-flow";
import { createListClosePackageHandler } from "./reports/close-package";
import { createListFeeRevenueHandler } from "./reports/fee-revenue";
import { createListFxRevaluationHandler } from "./reports/fx-revaluation";
import { createListGeneralLedgerHandler } from "./reports/general-ledger";
import {
  createComputeIncomeStatementCoreHandler,
  createListIncomeStatementHandler,
} from "./reports/income-statement";
import { createListLiquidityHandler } from "./reports/liquidity";
import { createListTrialBalanceHandler } from "./reports/trial-balance";
import type { AccountingReportsContext } from "./reports/types";

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
} from "./reports/types";

export function createAccountingReportsService(deps: {
  db: AccountingReportingServiceDeps["db"];
}) {
  const { db } = deps;

  const context: AccountingReportsContext = {
    db,
    ...createReportsSharedHelpers(db),
    ...createReportsScopeHelpers(db),
  };

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
  const listClosePackage = createListClosePackageHandler({
    context,
    listTrialBalance,
    listIncomeStatement,
    listCashFlow,
  });

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

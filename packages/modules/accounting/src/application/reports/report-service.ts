import type { Database, Transaction } from "@bedrock/platform-persistence";

import { createReportsScopeHelpers } from "../../infra/reporting/query-support/scope";
import { createReportsSharedHelpers } from "../../infra/reporting/query-support/shared";
import { createListBalanceSheetHandler } from "./queries/reports/balance-sheet";
import { createListCashFlowHandler } from "./queries/reports/cash-flow";
import { createListClosePackageHandler } from "./queries/reports/close-package";
import { createListFeeRevenueHandler } from "./queries/reports/fee-revenue";
import { createListFxRevaluationHandler } from "./queries/reports/fx-revaluation";
import { createListGeneralLedgerHandler } from "./queries/reports/general-ledger";
import {
  createComputeIncomeStatementCoreHandler,
  createListIncomeStatementHandler,
} from "./queries/reports/income-statement";
import { createListLiquidityHandler } from "./queries/reports/liquidity";
import { createListTrialBalanceHandler } from "./queries/reports/trial-balance";
import type { AccountingReportsContext } from "./types";

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

type Queryable = Database | Transaction;

export function createAccountingReportQueriesService(deps: {
  db: Queryable;
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

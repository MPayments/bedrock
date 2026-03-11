import {
  defineController,
  http,
  type DefinedController,
  type HttpRawResponseDescriptor,
} from "@bedrock/core";
import { AuthContextToken, requirePermissionMiddleware } from "@bedrock/security";
import {
  BalanceSheetQuerySchema,
  BalanceSheetResponseSchema,
  CashFlowQuerySchema,
  CashFlowResponseSchema,
  ClosePackageQuerySchema,
  ClosePackageResponseSchema,
  FeeRevenueQuerySchema,
  FeeRevenueResponseSchema,
  FxRevaluationQuerySchema,
  FxRevaluationResponseSchema,
  GeneralLedgerQuerySchema,
  GeneralLedgerResponseSchema,
  IncomeStatementQuerySchema,
  IncomeStatementResponseSchema,
  LiquidityQuerySchema,
  LiquidityResponseSchema,
  TrialBalanceQuerySchema,
  TrialBalanceResponseSchema,
} from "@multihansa/reporting/accounting-reporting";
import { replyTextFile, toCsvContent } from "@multihansa/common/bedrock";

import { accountingReportsService } from "./service";

const CsvResponse: HttpRawResponseDescriptor = http.response.raw({
  contentType: "text/csv; charset=utf-8",
});

export const accountingReportsController: DefinedController = defineController(
  "accounting-reports-http",
  {
    basePath: "/v1/accounting",
    deps: {
      auth: AuthContextToken,
    },
    ctx: ({ auth }) => ({ auth }),
    routes: ({ route }) => ({
      listTrialBalance: route.get({
        path: "/reports/trial-balance",
        request: {
          query: TrialBalanceQuerySchema,
        },
        responses: {
          200: TrialBalanceResponseSchema,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: accountingReportsService.actions.listTrialBalance,
      }),
      exportTrialBalance: route.get({
        path: "/reports/trial-balance/export",
        request: {
          query: TrialBalanceQuerySchema,
        },
        responses: {
          200: CsvResponse,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: async ({ call, request }) => {
          const result = await call(
            accountingReportsService.actions.exportTrialBalance,
            request.query,
          );
          return replyTextFile({
            filename: result.filename,
            contentType: "text/csv; charset=utf-8",
            content: toCsvContent(result.headers, result.rows),
          });
        },
      }),
      listGeneralLedger: route.get({
        path: "/reports/general-ledger",
        request: {
          query: GeneralLedgerQuerySchema,
        },
        responses: {
          200: GeneralLedgerResponseSchema,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: accountingReportsService.actions.listGeneralLedger,
      }),
      exportGeneralLedger: route.get({
        path: "/reports/general-ledger/export",
        request: {
          query: GeneralLedgerQuerySchema,
        },
        responses: {
          200: CsvResponse,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: async ({ call, request }) => {
          const result = await call(
            accountingReportsService.actions.exportGeneralLedger,
            request.query,
          );
          return replyTextFile({
            filename: result.filename,
            contentType: "text/csv; charset=utf-8",
            content: toCsvContent(result.headers, result.rows),
          });
        },
      }),
      listBalanceSheet: route.get({
        path: "/reports/balance-sheet",
        request: {
          query: BalanceSheetQuerySchema,
        },
        responses: {
          200: BalanceSheetResponseSchema,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: accountingReportsService.actions.listBalanceSheet,
      }),
      exportBalanceSheet: route.get({
        path: "/reports/balance-sheet/export",
        request: {
          query: BalanceSheetQuerySchema,
        },
        responses: {
          200: CsvResponse,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: async ({ call, request }) => {
          const result = await call(
            accountingReportsService.actions.exportBalanceSheet,
            request.query,
          );
          return replyTextFile({
            filename: result.filename,
            contentType: "text/csv; charset=utf-8",
            content: toCsvContent(result.headers, result.rows),
          });
        },
      }),
      listIncomeStatement: route.get({
        path: "/reports/income-statement",
        request: {
          query: IncomeStatementQuerySchema,
        },
        responses: {
          200: IncomeStatementResponseSchema,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: accountingReportsService.actions.listIncomeStatement,
      }),
      exportIncomeStatement: route.get({
        path: "/reports/income-statement/export",
        request: {
          query: IncomeStatementQuerySchema,
        },
        responses: {
          200: CsvResponse,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: async ({ call, request }) => {
          const result = await call(
            accountingReportsService.actions.exportIncomeStatement,
            request.query,
          );
          return replyTextFile({
            filename: result.filename,
            contentType: "text/csv; charset=utf-8",
            content: toCsvContent(result.headers, result.rows),
          });
        },
      }),
      listCashFlow: route.get({
        path: "/reports/cash-flow",
        request: {
          query: CashFlowQuerySchema,
        },
        responses: {
          200: CashFlowResponseSchema,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: accountingReportsService.actions.listCashFlow,
      }),
      exportCashFlow: route.get({
        path: "/reports/cash-flow/export",
        request: {
          query: CashFlowQuerySchema,
        },
        responses: {
          200: CsvResponse,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: async ({ call, request }) => {
          const result = await call(
            accountingReportsService.actions.exportCashFlow,
            request.query,
          );
          return replyTextFile({
            filename: result.filename,
            contentType: "text/csv; charset=utf-8",
            content: toCsvContent(result.headers, result.rows),
          });
        },
      }),
      listLiquidity: route.get({
        path: "/reports/liquidity",
        request: {
          query: LiquidityQuerySchema,
        },
        responses: {
          200: LiquidityResponseSchema,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: accountingReportsService.actions.listLiquidity,
      }),
      exportLiquidity: route.get({
        path: "/reports/liquidity/export",
        request: {
          query: LiquidityQuerySchema,
        },
        responses: {
          200: CsvResponse,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: async ({ call, request }) => {
          const result = await call(
            accountingReportsService.actions.exportLiquidity,
            request.query,
          );
          return replyTextFile({
            filename: result.filename,
            contentType: "text/csv; charset=utf-8",
            content: toCsvContent(result.headers, result.rows),
          });
        },
      }),
      listFxRevaluation: route.get({
        path: "/reports/treasury/fx-revaluation",
        request: {
          query: FxRevaluationQuerySchema,
        },
        responses: {
          200: FxRevaluationResponseSchema,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: accountingReportsService.actions.listFxRevaluation,
      }),
      exportFxRevaluation: route.get({
        path: "/reports/treasury/fx-revaluation/export",
        request: {
          query: FxRevaluationQuerySchema,
        },
        responses: {
          200: CsvResponse,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: async ({ call, request }) => {
          const result = await call(
            accountingReportsService.actions.exportFxRevaluation,
            request.query,
          );
          return replyTextFile({
            filename: result.filename,
            contentType: "text/csv; charset=utf-8",
            content: toCsvContent(result.headers, result.rows),
          });
        },
      }),
      listFeeRevenue: route.get({
        path: "/reports/fee-revenue",
        request: {
          query: FeeRevenueQuerySchema,
        },
        responses: {
          200: FeeRevenueResponseSchema,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: accountingReportsService.actions.listFeeRevenue,
      }),
      exportFeeRevenue: route.get({
        path: "/reports/fee-revenue/export",
        request: {
          query: FeeRevenueQuerySchema,
        },
        responses: {
          200: CsvResponse,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: async ({ call, request }) => {
          const result = await call(
            accountingReportsService.actions.exportFeeRevenue,
            request.query,
          );
          return replyTextFile({
            filename: result.filename,
            contentType: "text/csv; charset=utf-8",
            content: toCsvContent(result.headers, result.rows),
          });
        },
      }),
      getClosePackage: route.get({
        path: "/reports/close-package",
        request: {
          query: ClosePackageQuerySchema,
        },
        responses: {
          200: ClosePackageResponseSchema,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: accountingReportsService.actions.getClosePackage,
      }),
      exportClosePackage: route.get({
        path: "/reports/close-package/export",
        request: {
          query: ClosePackageQuerySchema,
        },
        responses: {
          200: CsvResponse,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: async ({ call, request }) => {
          const result = await call(
            accountingReportsService.actions.exportClosePackage,
            request.query,
          );
          return replyTextFile({
            filename: result.filename,
            contentType: "text/csv; charset=utf-8",
            content: toCsvContent(result.headers, result.rows),
          });
        },
      }),
    }),
  },
);

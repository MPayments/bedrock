import { createRoute, z } from "@hono/zod-openapi";

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
} from "@bedrock/application/accounting-reporting";

import { ErrorSchema } from "../../common";
import type { AppContext } from "../../context";
import { requirePermission } from "../../middleware/permission";
import { toReportCsvResponse } from "./csv";
import {
  handleAccountingRouteError,
  logReportMetrics,
  readAllPages,
  type AccountingRoutesApp,
  type PaginatedPayload,
} from "./report-route-kit";
import {
  mapBalanceSheetDto,
  mapCashFlowDto,
  mapClosePackageDto,
  mapFeeRevenueDto,
  mapFxRevaluationDto,
  mapGeneralLedgerDto,
  mapIncomeStatementDto,
  mapLiquidityDto,
  mapTrialBalanceDto,
} from "./mappers";

type ScopeMetaLike = {
  scopeType: string;
  attributionMode: string;
  resolvedCounterpartyIdsCount: number;
};

type ScopedDataPayload = {
  data: Record<string, unknown>[];
  scopeMeta: ScopeMetaLike;
};

type PaginatedScopedPayload = PaginatedPayload<Record<string, unknown>> &
  ScopedDataPayload;

type PaginatedReportDescriptor = {
  key: string;
  path: string;
  summary: string;
  exportSummary: string;
  querySchema: z.ZodTypeAny;
  responseSchema: z.ZodTypeAny;
  filename: string;
  headers: string[];
  load: (query: any) => Promise<PaginatedPayload<unknown> & {
    scopeMeta: ScopeMetaLike;
  }>;
  map: (result: any) => PaginatedScopedPayload;
};

type SimpleReportDescriptor = {
  key: string;
  path: string;
  summary: string;
  exportSummary: string;
  querySchema: z.ZodTypeAny;
  responseSchema: z.ZodTypeAny;
  filename: string;
  headers: string[];
  load: (query: any) => Promise<any>;
  map: (result: any) => ScopedDataPayload;
};

const EXPORT_PAGE_SIZE = 200;

function registerPaginatedReport(
  app: AccountingRoutesApp,
  ctx: AppContext,
  descriptor: PaginatedReportDescriptor,
) {
  const listRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: descriptor.path,
    tags: ["Accounting"],
    summary: descriptor.summary,
    request: {
      query: descriptor.querySchema as any,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: descriptor.responseSchema,
          },
        },
        description: `${descriptor.summary} report`,
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
    },
  });

  const exportRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: `${descriptor.path}/export`,
    tags: ["Accounting"],
    summary: descriptor.exportSummary,
    request: {
      query: descriptor.querySchema as any,
    },
    responses: {
      200: {
        content: {
          "text/csv": {
            schema: z.string(),
          },
        },
        description: "CSV export",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
    },
  });

  app.openapi(listRoute, async (c) => {
    try {
      const startedAt = Date.now();
      const query = (c.req as any).valid("query") as Record<string, unknown>;
      const result = await descriptor.load(query);
      const payload = descriptor.map(result as unknown as Record<string, unknown>);

      logReportMetrics(ctx, {
        reportKey: descriptor.key,
        startedAt,
        rowCount: payload.data.length,
        scopeType: payload.scopeMeta.scopeType,
        attributionMode: payload.scopeMeta.attributionMode,
        resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
      });

      return c.json(payload, 200);
    } catch (error) {
      return handleAccountingRouteError(c, error);
    }
  });

  app.openapi(exportRoute, async (c) => {
    try {
      const startedAt = Date.now();
      const query = (c.req as any).valid("query") as Record<string, unknown>;
      const firstPage = await descriptor.load({
        ...query,
        limit: EXPORT_PAGE_SIZE,
        offset: 0,
      });
      const rows = await readAllPages(firstPage, ({ limit, offset }) =>
        descriptor.load({
          ...query,
          limit,
          offset,
        }),
      );
      const payload = descriptor.map({
        ...firstPage,
        data: rows,
      } as unknown as Record<string, unknown>);

      logReportMetrics(ctx, {
        reportKey: descriptor.key,
        startedAt,
        rowCount: payload.data.length,
        scopeType: payload.scopeMeta.scopeType,
        attributionMode: payload.scopeMeta.attributionMode,
        resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
      });

      return toReportCsvResponse(c, {
        filename: descriptor.filename,
        headers: descriptor.headers,
        rows: payload.data,
      });
    } catch (error) {
      return handleAccountingRouteError(c, error);
    }
  });
}

function registerSimpleReport(
  app: AccountingRoutesApp,
  ctx: AppContext,
  descriptor: SimpleReportDescriptor,
) {
  const listRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: descriptor.path,
    tags: ["Accounting"],
    summary: descriptor.summary,
    request: {
      query: descriptor.querySchema as any,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: descriptor.responseSchema,
          },
        },
        description: `${descriptor.summary} report`,
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
    },
  });

  const exportRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: `${descriptor.path}/export`,
    tags: ["Accounting"],
    summary: descriptor.exportSummary,
    request: {
      query: descriptor.querySchema as any,
    },
    responses: {
      200: {
        content: {
          "text/csv": {
            schema: z.string(),
          },
        },
        description: "CSV export",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
    },
  });

  app.openapi(listRoute, async (c) => {
    try {
      const startedAt = Date.now();
      const query = (c.req as any).valid("query") as Record<string, unknown>;
      const result = await descriptor.load(query);
      const payload = descriptor.map(result);

      logReportMetrics(ctx, {
        reportKey: descriptor.key,
        startedAt,
        rowCount: payload.data.length,
        scopeType: payload.scopeMeta.scopeType,
        attributionMode: payload.scopeMeta.attributionMode,
        resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
      });

      return c.json(payload, 200);
    } catch (error) {
      return handleAccountingRouteError(c, error);
    }
  });

  app.openapi(exportRoute, async (c) => {
    try {
      const startedAt = Date.now();
      const query = (c.req as any).valid("query") as Record<string, unknown>;
      const result = await descriptor.load(query);
      const payload = descriptor.map(result);

      logReportMetrics(ctx, {
        reportKey: descriptor.key,
        startedAt,
        rowCount: payload.data.length,
        scopeType: payload.scopeMeta.scopeType,
        attributionMode: payload.scopeMeta.attributionMode,
        resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
      });

      return toReportCsvResponse(c, {
        filename: descriptor.filename,
        headers: descriptor.headers,
        rows: payload.data,
      });
    } catch (error) {
      return handleAccountingRouteError(c, error);
    }
  });
}

function buildClosePackageRows(payload: ReturnType<typeof mapClosePackageDto>) {
  return [
    ...payload.trialBalanceSummaryByCurrency.map((item) => ({
      section: "trial_balance_summary",
      currency: item.currency,
      openingDebit: item.openingDebit,
      openingCredit: item.openingCredit,
      periodDebit: item.periodDebit,
      periodCredit: item.periodCredit,
      closingDebit: item.closingDebit,
      closingCredit: item.closingCredit,
    })),
    ...payload.incomeStatementSummaryByCurrency.map((item) => ({
      section: "income_statement_summary",
      currency: item.currency,
      revenue: item.revenue,
      expense: item.expense,
      net: item.net,
    })),
    ...payload.cashFlowSummaryByCurrency.map((item) => ({
      section: "cash_flow_summary",
      currency: item.currency,
      netCashFlow: item.netCashFlow,
    })),
    ...payload.adjustments.map((item) => ({
      section: "adjustment",
      documentId: item.documentId,
      docType: item.docType,
      docNo: item.docNo,
      occurredAt: item.occurredAt,
      title: item.title,
    })),
    ...payload.auditEvents.map((item) => ({
      section: "audit_event",
      id: item.id,
      eventType: item.eventType,
      actorId: item.actorId,
      createdAt: item.createdAt,
    })),
  ] satisfies Record<string, unknown>[];
}

export function registerAccountingReportRoutes(
  app: AccountingRoutesApp,
  ctx: AppContext,
) {
  const paginatedReports: PaginatedReportDescriptor[] = [
    {
      key: "trial-balance",
      path: "/reports/trial-balance",
      summary: "Trial balance (opening, movements, closing)",
      exportSummary: "Export trial balance to CSV",
      querySchema: TrialBalanceQuerySchema,
      responseSchema: TrialBalanceResponseSchema,
      filename: "trial-balance.csv",
      headers: [
        "accountNo",
        "accountName",
        "accountKind",
        "currency",
        "openingDebit",
        "openingCredit",
        "periodDebit",
        "periodCredit",
        "closingDebit",
        "closingCredit",
      ],
      load: (query) => ctx.accountingReportingService.listTrialBalance(query),
      map: (result) => mapTrialBalanceDto(result as Parameters<typeof mapTrialBalanceDto>[0]),
    },
    {
      key: "general-ledger",
      path: "/reports/general-ledger",
      summary: "General ledger account statement",
      exportSummary: "Export general ledger to CSV",
      querySchema: GeneralLedgerQuerySchema,
      responseSchema: GeneralLedgerResponseSchema,
      filename: "general-ledger.csv",
      headers: [
        "operationId",
        "lineNo",
        "postingDate",
        "bookId",
        "bookLabel",
        "accountNo",
        "currency",
        "postingCode",
        "counterpartyId",
        "debit",
        "credit",
        "runningBalance",
      ],
      load: (query) => ctx.accountingReportingService.listGeneralLedger(query),
      map: (result) => mapGeneralLedgerDto(result as Parameters<typeof mapGeneralLedgerDto>[0]),
    },
    {
      key: "liquidity",
      path: "/reports/liquidity",
      summary: "Liquidity position by book/entity/currency",
      exportSummary: "Export liquidity report to CSV",
      querySchema: LiquidityQuerySchema,
      responseSchema: LiquidityResponseSchema,
      filename: "liquidity.csv",
      headers: [
        "bookId",
        "bookLabel",
        "counterpartyId",
        "counterpartyName",
        "currency",
        "ledgerBalance",
        "available",
        "reserved",
        "pending",
      ],
      load: (query) => ctx.accountingReportingService.listLiquidity(query),
      map: (result) => mapLiquidityDto(result as Parameters<typeof mapLiquidityDto>[0]),
    },
    {
      key: "fee-revenue",
      path: "/reports/fee-revenue",
      summary: "Fee revenue breakdown",
      exportSummary: "Export fee revenue report to CSV",
      querySchema: FeeRevenueQuerySchema,
      responseSchema: FeeRevenueResponseSchema,
      filename: "fee-revenue.csv",
      headers: [
        "product",
        "channel",
        "counterpartyId",
        "counterpartyName",
        "currency",
        "feeRevenue",
        "spreadRevenue",
        "providerFeeExpense",
        "net",
      ],
      load: (query) => ctx.accountingReportingService.listFeeRevenueBreakdown(query),
      map: (result) => mapFeeRevenueDto(result as Parameters<typeof mapFeeRevenueDto>[0]),
    },
  ];

  const simpleReports: SimpleReportDescriptor[] = [
    {
      key: "balance-sheet",
      path: "/reports/balance-sheet",
      summary: "Balance sheet (as-of)",
      exportSummary: "Export balance sheet to CSV",
      querySchema: BalanceSheetQuerySchema,
      responseSchema: BalanceSheetResponseSchema,
      filename: "balance-sheet.csv",
      headers: ["section", "lineCode", "lineLabel", "currency", "amount"],
      load: (query) => ctx.accountingReportingService.listBalanceSheet(query),
      map: (result) => mapBalanceSheetDto(result as Parameters<typeof mapBalanceSheetDto>[0]),
    },
    {
      key: "income-statement",
      path: "/reports/income-statement",
      summary: "Income statement (P&L)",
      exportSummary: "Export income statement to CSV",
      querySchema: IncomeStatementQuerySchema,
      responseSchema: IncomeStatementResponseSchema,
      filename: "income-statement.csv",
      headers: ["section", "lineCode", "lineLabel", "currency", "amount"],
      load: (query) => ctx.accountingReportingService.listIncomeStatement(query),
      map: (result) => mapIncomeStatementDto(result as Parameters<typeof mapIncomeStatementDto>[0]),
    },
    {
      key: "cash-flow",
      path: "/reports/cash-flow",
      summary: "Cash flow (direct/indirect)",
      exportSummary: "Export cash flow report to CSV",
      querySchema: CashFlowQuerySchema,
      responseSchema: CashFlowResponseSchema,
      filename: "cash-flow.csv",
      headers: ["section", "lineCode", "lineLabel", "currency", "amount"],
      load: (query) => ctx.accountingReportingService.listCashFlow(query),
      map: (result) => mapCashFlowDto(result as Parameters<typeof mapCashFlowDto>[0]),
    },
    {
      key: "fx-revaluation",
      path: "/reports/fx-revaluation",
      summary: "FX revaluation (realized/unrealized)",
      exportSummary: "Export FX revaluation report to CSV",
      querySchema: FxRevaluationQuerySchema,
      responseSchema: FxRevaluationResponseSchema,
      filename: "fx-revaluation.csv",
      headers: ["bucket", "currency", "revenue", "expense", "net"],
      load: (query) => ctx.accountingReportingService.listFxRevaluation(query),
      map: (result) => mapFxRevaluationDto(result as Parameters<typeof mapFxRevaluationDto>[0]),
    },
  ];

  for (const descriptor of paginatedReports) {
    registerPaginatedReport(app, ctx, descriptor);
  }

  for (const descriptor of simpleReports) {
    registerSimpleReport(app, ctx, descriptor);
  }

  const getClosePackageRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/close-package",
    tags: ["Accounting"],
    summary: "Close package snapshot for counterparty and period",
    request: {
      query: ClosePackageQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ClosePackageResponseSchema,
          },
        },
        description: "Close package",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
    },
  });

  const exportClosePackageRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/close-package/export",
    tags: ["Accounting"],
    summary: "Export close package report to CSV",
    request: {
      query: ClosePackageQuerySchema,
    },
    responses: {
      200: {
        content: {
          "text/csv": {
            schema: z.string(),
          },
        },
        description: "CSV export",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
    },
  });

  app.openapi(getClosePackageRoute, async (c) => {
    try {
      const startedAt = Date.now();
      const query = (c.req as any).valid("query") as Record<string, unknown>;
      const result = await ctx.accountingReportingService.listClosePackage(query as any);
      const payload = mapClosePackageDto(result);

      logReportMetrics(ctx, {
        reportKey: "close-package",
        startedAt,
        rowCount:
          payload.trialBalanceSummaryByCurrency.length +
          payload.incomeStatementSummaryByCurrency.length +
          payload.cashFlowSummaryByCurrency.length +
          payload.adjustments.length +
          payload.auditEvents.length,
        scopeType: "counterparty",
        attributionMode: "analytic_counterparty",
        resolvedCounterpartyCount: 1,
      });

      return c.json(payload, 200);
    } catch (error) {
      return handleAccountingRouteError(c, error);
    }
  });

  app.openapi(exportClosePackageRoute, async (c) => {
    try {
      const startedAt = Date.now();
      const query = (c.req as any).valid("query") as Record<string, unknown>;
      const result = await ctx.accountingReportingService.listClosePackage(query as any);
      const payload = mapClosePackageDto(result);
      const rows = buildClosePackageRows(payload);

      logReportMetrics(ctx, {
        reportKey: "close-package",
        startedAt,
        rowCount: rows.length,
        scopeType: "counterparty",
        attributionMode: "analytic_counterparty",
        resolvedCounterpartyCount: 1,
      });

      return toReportCsvResponse(c, {
        filename: "close-package.csv",
        headers: [
          "section",
          "currency",
          "openingDebit",
          "openingCredit",
          "periodDebit",
          "periodCredit",
          "closingDebit",
          "closingCredit",
          "revenue",
          "expense",
          "net",
          "netCashFlow",
          "documentId",
          "docType",
          "docNo",
          "occurredAt",
          "title",
          "id",
          "eventType",
          "actorId",
          "createdAt",
        ],
        rows,
      });
    } catch (error) {
      return handleAccountingRouteError(c, error);
    }
  });

  return app;
}

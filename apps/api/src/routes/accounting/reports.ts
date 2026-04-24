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
} from "@bedrock/accounting/contracts";

import { toReportCsvResponse } from "./csv";
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
import {
  createAccountingRouteApp,
  handleAccountingRouteError,
  logReportMetrics,
  readAllPages,
  type PaginatedPayload,
} from "./report-route-kit";
import { ErrorSchema } from "../../common";
import type { AppContext } from "../../context";
import { requirePermission } from "../../middleware/permission";

interface ScopeMetaLike {
  scopeType: string;
  attributionMode: string;
  resolvedCounterpartyIdsCount: number;
}

interface ScopedDataPayload {
  data: Record<string, unknown>[];
  scopeMeta: ScopeMetaLike;
}

type PaginatedScopedPayload = PaginatedPayload<Record<string, unknown>> &
  ScopedDataPayload;

type PaginatedReportLoadResult = PaginatedPayload<unknown> & {
  scopeMeta: ScopeMetaLike;
};

type RouteQuerySchema =
  | z.ZodObject<z.ZodRawShape>
  | z.ZodPipe<z.ZodTypeAny, z.ZodTypeAny>;

interface ReportRouteBase<
  TQuerySchema extends RouteQuerySchema,
  TResponseSchema extends z.ZodTypeAny,
> {
  key: string;
  summary: string;
  exportSummary: string;
  querySchema: TQuerySchema;
  responseSchema: TResponseSchema;
  filename: string;
  headers: string[];
}

interface ReportDescriptor<
  TQuerySchema extends RouteQuerySchema,
  TResponseSchema extends z.ZodTypeAny,
  TLoadResult,
  TPayload extends ScopedDataPayload,
> extends ReportRouteBase<TQuerySchema, TResponseSchema> {
  load: (query: z.infer<TQuerySchema>) => Promise<TLoadResult>;
  map: (result: TLoadResult) => TPayload;
}

type PaginatedReportDescriptor<
  TQuerySchema extends RouteQuerySchema,
  TResponseSchema extends z.ZodTypeAny,
  TLoadResult extends PaginatedReportLoadResult,
> = ReportDescriptor<
  TQuerySchema,
  TResponseSchema,
  TLoadResult,
  PaginatedScopedPayload
>;

type SimpleReportDescriptor<
  TQuerySchema extends RouteQuerySchema,
  TResponseSchema extends z.ZodTypeAny,
  TLoadResult,
> = ReportDescriptor<
  TQuerySchema,
  TResponseSchema,
  TLoadResult,
  ScopedDataPayload
>;

const EXPORT_PAGE_SIZE = 200;

function createReportListRoute<
  TQuerySchema extends RouteQuerySchema,
  TResponseSchema extends z.ZodTypeAny,
>(descriptor: ReportRouteBase<TQuerySchema, TResponseSchema>) {
  return createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Accounting"],
    summary: descriptor.summary,
    request: {
      query: descriptor.querySchema,
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
}

function createReportExportRoute<TQuerySchema extends RouteQuerySchema>(
  descriptor: Pick<
    ReportRouteBase<TQuerySchema, z.ZodTypeAny>,
    "exportSummary" | "querySchema"
  >,
) {
  return createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/export",
    tags: ["Accounting"],
    summary: descriptor.exportSummary,
    request: {
      query: descriptor.querySchema,
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
}

function logDescriptorReportMetrics(
  ctx: AppContext,
  input: {
    descriptor: Pick<ReportRouteBase<RouteQuerySchema, z.ZodTypeAny>, "key">;
    payload: ScopedDataPayload;
    startedAt: number;
  },
) {
  const { descriptor, payload, startedAt } = input;

  logReportMetrics(ctx, {
    reportKey: descriptor.key,
    startedAt,
    rowCount: payload.data.length,
    scopeType: payload.scopeMeta.scopeType,
    attributionMode: payload.scopeMeta.attributionMode,
    resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
  });
}

function createReportListHandler<
  TQuerySchema extends RouteQuerySchema,
  TResponseSchema extends z.ZodTypeAny,
  TLoadResult,
  TPayload extends ScopedDataPayload,
>(
  ctx: AppContext,
  descriptor: ReportDescriptor<
    TQuerySchema,
    TResponseSchema,
    TLoadResult,
    TPayload
  >,
) {
  return (async (c: any) => {
    try {
      const startedAt = Date.now();
      const query = (c.req as any).valid("query") as z.infer<TQuerySchema>;
      const result = await descriptor.load(query);
      const payload = descriptor.map(result);

      logDescriptorReportMetrics(ctx, {
        descriptor,
        payload,
        startedAt,
      });

      return c.json(payload as z.infer<TResponseSchema>, 200);
    } catch (error) {
      return handleAccountingRouteError(c, error);
    }
  }) as any;
}

function createPaginatedReportRoutes<
  TQuerySchema extends RouteQuerySchema,
  TResponseSchema extends z.ZodTypeAny,
  TLoadResult extends PaginatedReportLoadResult,
>(
  ctx: AppContext,
  descriptor: PaginatedReportDescriptor<
    TQuerySchema,
    TResponseSchema,
    TLoadResult
  >,
) {
  const app = createAccountingRouteApp();
  const listRoute = createReportListRoute(descriptor);
  const exportRoute = createReportExportRoute(descriptor);

  return app
    .openapi(listRoute, createReportListHandler(ctx, descriptor))
    .openapi(exportRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = (c.req as any).valid("query") as z.infer<TQuerySchema>;
        const baseQuery = query as Record<string, unknown>;
        const firstPage = await descriptor.load({
          ...baseQuery,
          limit: EXPORT_PAGE_SIZE,
          offset: 0,
        } as z.infer<TQuerySchema>);
        const rows = await readAllPages(firstPage, ({ limit, offset }) =>
          descriptor.load({
            ...baseQuery,
            limit,
            offset,
          } as z.infer<TQuerySchema>),
        );
        const payload = descriptor.map({
          ...firstPage,
          data: rows,
        } as TLoadResult);

        logDescriptorReportMetrics(ctx, {
          descriptor,
          payload,
          startedAt,
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

function createSimpleReportRoutes<
  TQuerySchema extends RouteQuerySchema,
  TResponseSchema extends z.ZodTypeAny,
  TLoadResult,
>(
  ctx: AppContext,
  descriptor: SimpleReportDescriptor<
    TQuerySchema,
    TResponseSchema,
    TLoadResult
  >,
) {
  const app = createAccountingRouteApp();
  const listRoute = createReportListRoute(descriptor);
  const exportRoute = createReportExportRoute(descriptor);

  return app
    .openapi(listRoute, createReportListHandler(ctx, descriptor))
    .openapi(exportRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = (c.req as any).valid("query") as z.infer<TQuerySchema>;
        const result = await descriptor.load(query);
        const payload = descriptor.map(result);

        logDescriptorReportMetrics(ctx, {
          descriptor,
          payload,
          startedAt,
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

function createClosePackageReportRoutes(ctx: AppContext) {
  const app = createAccountingRouteApp();

  const getClosePackageRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Accounting"],
    summary: "Close package snapshot for organization and period",
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
    path: "/export",
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

  return app
    .openapi(getClosePackageRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result =
          await ctx.accountingModule.reports.queries.listClosePackage(query);
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
          scopeType: "book",
          attributionMode: "book_org",
          resolvedCounterpartyCount: 1,
        });

        return c.json(payload, 200);
      } catch (error) {
        return handleAccountingRouteError(c, error);
      }
    })
    .openapi(exportClosePackageRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result =
          await ctx.accountingModule.reports.queries.listClosePackage(query);
        const payload = mapClosePackageDto(result);
        const rows = buildClosePackageRows(payload);

        logReportMetrics(ctx, {
          reportKey: "close-package",
          startedAt,
          rowCount: rows.length,
          scopeType: "book",
          attributionMode: "book_org",
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
}

export function accountingReportRoutes(ctx: AppContext) {
  return createAccountingRouteApp()
    .route(
      "/trial-balance",
      createPaginatedReportRoutes(ctx, {
        key: "trial-balance",
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
        load: (query) =>
          ctx.accountingModule.reports.queries.listTrialBalance(query),
        map: (result) => mapTrialBalanceDto(result),
      }),
    )
    .route(
      "/general-ledger",
      createPaginatedReportRoutes(ctx, {
        key: "general-ledger",
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
        load: (query) =>
          ctx.accountingModule.reports.queries.listGeneralLedger(query),
        map: (result) => mapGeneralLedgerDto(result),
      }),
    )
    .route(
      "/liquidity",
      createPaginatedReportRoutes(ctx, {
        key: "liquidity",
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
        load: (query) =>
          ctx.accountingModule.reports.queries.listLiquidity(query),
        map: (result) => mapLiquidityDto(result),
      }),
    )
    .route(
      "/fee-revenue",
      createPaginatedReportRoutes(ctx, {
        key: "fee-revenue",
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
        load: (query) =>
          ctx.accountingModule.reports.queries.listFeeRevenueBreakdown(query),
        map: (result) => mapFeeRevenueDto(result),
      }),
    )
    .route(
      "/balance-sheet",
      createSimpleReportRoutes(ctx, {
        key: "balance-sheet",
        summary: "Balance sheet (as-of)",
        exportSummary: "Export balance sheet to CSV",
        querySchema: BalanceSheetQuerySchema,
        responseSchema: BalanceSheetResponseSchema,
        filename: "balance-sheet.csv",
        headers: ["section", "lineCode", "lineLabel", "currency", "amount"],
        load: (query) =>
          ctx.accountingModule.reports.queries.listBalanceSheet(query),
        map: (result) => mapBalanceSheetDto(result),
      }),
    )
    .route(
      "/income-statement",
      createSimpleReportRoutes(ctx, {
        key: "income-statement",
        summary: "Income statement (P&L)",
        exportSummary: "Export income statement to CSV",
        querySchema: IncomeStatementQuerySchema,
        responseSchema: IncomeStatementResponseSchema,
        filename: "income-statement.csv",
        headers: ["section", "lineCode", "lineLabel", "currency", "amount"],
        load: (query) =>
          ctx.accountingModule.reports.queries.listIncomeStatement(query),
        map: (result) => mapIncomeStatementDto(result),
      }),
    )
    .route(
      "/cash-flow",
      createSimpleReportRoutes(ctx, {
        key: "cash-flow",
        summary: "Cash flow (direct/indirect)",
        exportSummary: "Export cash flow report to CSV",
        querySchema: CashFlowQuerySchema,
        responseSchema: CashFlowResponseSchema,
        filename: "cash-flow.csv",
        headers: ["section", "lineCode", "lineLabel", "currency", "amount"],
        load: (query) =>
          ctx.accountingModule.reports.queries.listCashFlow(query),
        map: (result) => mapCashFlowDto(result),
      }),
    )
    .route(
      "/fx-revaluation",
      createSimpleReportRoutes(ctx, {
        key: "fx-revaluation",
        summary: "FX revaluation (realized/unrealized)",
        exportSummary: "Export FX revaluation report to CSV",
        querySchema: FxRevaluationQuerySchema,
        responseSchema: FxRevaluationResponseSchema,
        filename: "fx-revaluation.csv",
        headers: ["bucket", "currency", "revenue", "expense", "net"],
        load: (query) =>
          ctx.accountingModule.reports.queries.listFxRevaluation(query),
        map: (result) => mapFxRevaluationDto(result),
      }),
    )
    .route("/close-package", createClosePackageReportRoutes(ctx));
}

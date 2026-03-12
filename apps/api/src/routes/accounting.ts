import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { replaceCorrespondenceRulesSchema } from "@bedrock/application/accounting";
import {
  AccountingCorrespondenceRuleSchema,
  AccountingTemplateAccountSchema,
} from "@bedrock/application/accounting/contracts";
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
import { ValidationError } from "@bedrock/common/errors";

import { ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
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
} from "./accounting/mappers";

const ValidatePostingMatrixResultSchema = z.object({
  ok: z.boolean(),
  errors: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      postingCode: z.string().optional(),
      accountNo: z.string().optional(),
    }),
  ),
});

function asCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const rendered = typeof value === "string" ? value : String(value);
  if (!/[",\n\r]/.test(rendered)) {
    return rendered;
  }

  return `"${rendered.replaceAll("\"", "\"\"")}"`;
}

function toCsvContent(headers: string[], rows: Record<string, unknown>[]): string {
  const head = headers.join(",");
  const body = rows.map((row) => headers.map((key) => asCsvCell(row[key])).join(","));
  return [head, ...body].join("\n");
}

interface PaginatedPayload<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

async function readAllPages<T>(
  firstPage: PaginatedPayload<T>,
  loadPage: (input: { limit: number; offset: number }) => Promise<PaginatedPayload<T>>,
): Promise<T[]> {
  const rows: T[] = [...firstPage.data];
  let offset = firstPage.offset + firstPage.data.length;
  const pageSize = firstPage.limit;

  while (true) {
    if (rows.length >= firstPage.total) {
      break;
    }

    const page = await loadPage({ limit: pageSize, offset });
    if (page.data.length === 0) {
      break;
    }

    rows.push(...page.data);
    offset += page.data.length;
  }

  return rows;
}

function toReportCsvResponse(
  c: { body: (body: string, status: number, headers: Record<string, string>) => Response },
  input: {
    filename: string;
    headers: string[];
    rows: Record<string, unknown>[];
  },
) {
  return c.body(toCsvContent(input.headers, input.rows), 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${input.filename}"`,
  });
}

function logReportMetrics(
  ctx: AppContext,
  input: {
    reportKey: string;
    startedAt: number;
    rowCount: number;
    scopeType?: string;
    attributionMode?: string;
    resolvedCounterpartyCount?: number;
  },
) {
  ctx.logger.info("Accounting report generated", {
    reportKey: input.reportKey,
    scopeType: input.scopeType ?? "n/a",
    attributionMode: input.attributionMode ?? "n/a",
    resolvedCounterpartyCount: input.resolvedCounterpartyCount ?? 0,
    durationMs: Date.now() - input.startedAt,
    rowCount: input.rowCount,
  });
}

export function accountingRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listTemplateAccountsRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/template/accounts",
    tags: ["Accounting"],
    summary: "List global chart template accounts",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(AccountingTemplateAccountSchema),
          },
        },
        description: "Template accounts",
      },
    },
  });

  const listRulesRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/correspondence-rules",
    tags: ["Accounting"],
    summary: "List global correspondence rules",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(AccountingCorrespondenceRuleSchema),
          },
        },
        description: "Rules",
      },
    },
  });

  const replaceRulesRoute = createRoute({
    middleware: [requirePermission({ accounting: ["manage_correspondence"] })],
    method: "put",
    path: "/correspondence-rules",
    tags: ["Accounting"],
    summary: "Replace global correspondence rules",
    request: {
      body: {
        content: {
          "application/json": {
            schema: replaceCorrespondenceRulesSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(AccountingCorrespondenceRuleSchema),
          },
        },
        description: "Rules replaced",
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

  const validatePostingMatrixRoute = createRoute({
    middleware: [requirePermission({ accounting: ["manage_correspondence"] })],
    method: "post",
    path: "/correspondence-rules/validate",
    tags: ["Accounting"],
    summary: "Validate posting matrix and account analytics consistency",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ValidatePostingMatrixResultSchema,
          },
        },
        description: "Validation result",
      },
    },
  });

  const listTrialBalanceRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/trial-balance",
    tags: ["Accounting"],
    summary: "Trial balance (opening, movements, closing)",
    request: {
      query: TrialBalanceQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: TrialBalanceResponseSchema,
          },
        },
        description: "Trial balance report",
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

  const exportTrialBalanceRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/trial-balance/export",
    tags: ["Accounting"],
    summary: "Export trial balance to CSV",
    request: {
      query: TrialBalanceQuerySchema,
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

  const listGeneralLedgerRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/general-ledger",
    tags: ["Accounting"],
    summary: "General ledger account statement",
    request: {
      query: GeneralLedgerQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: GeneralLedgerResponseSchema,
          },
        },
        description: "General ledger report",
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

  const exportGeneralLedgerRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/general-ledger/export",
    tags: ["Accounting"],
    summary: "Export general ledger to CSV",
    request: {
      query: GeneralLedgerQuerySchema,
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

  const listBalanceSheetRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/balance-sheet",
    tags: ["Accounting"],
    summary: "Balance sheet (as-of)",
    request: {
      query: BalanceSheetQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: BalanceSheetResponseSchema,
          },
        },
        description: "Balance sheet report",
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

  const exportBalanceSheetRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/balance-sheet/export",
    tags: ["Accounting"],
    summary: "Export balance sheet to CSV",
    request: {
      query: BalanceSheetQuerySchema,
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

  const listIncomeStatementRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/income-statement",
    tags: ["Accounting"],
    summary: "Income statement (P&L)",
    request: {
      query: IncomeStatementQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: IncomeStatementResponseSchema,
          },
        },
        description: "Income statement report",
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

  const exportIncomeStatementRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/income-statement/export",
    tags: ["Accounting"],
    summary: "Export income statement to CSV",
    request: {
      query: IncomeStatementQuerySchema,
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

  const listCashFlowRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/cash-flow",
    tags: ["Accounting"],
    summary: "Cash flow (direct/indirect)",
    request: {
      query: CashFlowQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CashFlowResponseSchema,
          },
        },
        description: "Cash flow report",
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

  const exportCashFlowRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/cash-flow/export",
    tags: ["Accounting"],
    summary: "Export cash flow report to CSV",
    request: {
      query: CashFlowQuerySchema,
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

  const listLiquidityRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/liquidity",
    tags: ["Accounting"],
    summary: "Liquidity position by book/entity/currency",
    request: {
      query: LiquidityQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: LiquidityResponseSchema,
          },
        },
        description: "Liquidity report",
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

  const exportLiquidityRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/liquidity/export",
    tags: ["Accounting"],
    summary: "Export liquidity report to CSV",
    request: {
      query: LiquidityQuerySchema,
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

  const listFxRevaluationRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/fx-revaluation",
    tags: ["Accounting"],
    summary: "FX revaluation (realized/unrealized)",
    request: {
      query: FxRevaluationQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: FxRevaluationResponseSchema,
          },
        },
        description: "FX revaluation report",
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

  const exportFxRevaluationRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/fx-revaluation/export",
    tags: ["Accounting"],
    summary: "Export FX revaluation report to CSV",
    request: {
      query: FxRevaluationQuerySchema,
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

  const listFeeRevenueRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/fee-revenue",
    tags: ["Accounting"],
    summary: "Fee revenue breakdown",
    request: {
      query: FeeRevenueQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: FeeRevenueResponseSchema,
          },
        },
        description: "Fee revenue report",
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

  const exportFeeRevenueRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/reports/fee-revenue/export",
    tags: ["Accounting"],
    summary: "Export fee revenue report to CSV",
    request: {
      query: FeeRevenueQuerySchema,
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

  return app
    .openapi(listTemplateAccountsRoute, async (c) => {
      const rows = await ctx.accountingService.listTemplateAccounts();
      return c.json(
        rows.map((row) => ({
          accountNo: row.accountNo,
          name: row.name,
          kind: row.kind,
          normalSide: row.normalSide,
          postingAllowed: row.postingAllowed,
          enabled: row.enabled,
          parentAccountNo: row.parentAccountNo,
          createdAt: row.createdAt.toISOString(),
        })),
        200,
      );
    })
    .openapi(listRulesRoute, async (c) => {
      const rows = await ctx.accountingService.listCorrespondenceRules();
      return c.json(
        rows.map((row) => ({
          id: row.id,
          postingCode: row.postingCode,
          debitAccountNo: row.debitAccountNo,
          creditAccountNo: row.creditAccountNo,
          enabled: row.enabled,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
        200,
      );
    })
    .openapi(replaceRulesRoute, async (c) => {
      try {
        const body = c.req.valid("json");
        const rows =
          await ctx.accountingService.replaceCorrespondenceRules(body);
        return c.json(
          rows.map((row) => ({
            id: row.id,
            postingCode: row.postingCode,
            debitAccountNo: row.debitAccountNo,
            creditAccountNo: row.creditAccountNo,
            enabled: row.enabled,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          })),
          200,
        );
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(validatePostingMatrixRoute, async (c) => {
      const result = await ctx.accountingService.validatePostingMatrix();
      return c.json(result, 200);
    })
    .openapi(listTrialBalanceRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result = await ctx.accountingReportingService.listTrialBalance(query);
        const payload = mapTrialBalanceDto(result);

        logReportMetrics(ctx, {
          reportKey: "trial-balance",
          startedAt,
          rowCount: payload.data.length,
          scopeType: payload.scopeMeta.scopeType,
          attributionMode: payload.scopeMeta.attributionMode,
          resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return c.json(payload, 200);
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(exportTrialBalanceRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const firstPage = await ctx.accountingReportingService.listTrialBalance({
          ...query,
          limit: 200,
          offset: 0,
        });
        const rows = await readAllPages(firstPage, ({ limit, offset }) =>
          ctx.accountingReportingService.listTrialBalance({
            ...query,
            limit,
            offset,
          }),
        );

        const mappedRows = mapTrialBalanceDto({
          ...firstPage,
          data: rows,
        }).data;

        logReportMetrics(ctx, {
          reportKey: "trial-balance",
          startedAt,
          rowCount: mappedRows.length,
          scopeType: firstPage.scopeMeta.scopeType,
          attributionMode: firstPage.scopeMeta.attributionMode,
          resolvedCounterpartyCount: firstPage.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return toReportCsvResponse(c, {
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
          rows: mappedRows,
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(listGeneralLedgerRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result = await ctx.accountingReportingService.listGeneralLedger(query);
        const payload = mapGeneralLedgerDto(result);

        logReportMetrics(ctx, {
          reportKey: "general-ledger",
          startedAt,
          rowCount: payload.data.length,
          scopeType: payload.scopeMeta.scopeType,
          attributionMode: payload.scopeMeta.attributionMode,
          resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return c.json(payload, 200);
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(exportGeneralLedgerRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const firstPage = await ctx.accountingReportingService.listGeneralLedger({
          ...query,
          limit: 200,
          offset: 0,
        });
        const rows = await readAllPages(firstPage, ({ limit, offset }) =>
          ctx.accountingReportingService.listGeneralLedger({
            ...query,
            limit,
            offset,
          }),
        );

        const mappedRows = mapGeneralLedgerDto({
          ...firstPage,
          data: rows,
        }).data;

        logReportMetrics(ctx, {
          reportKey: "general-ledger",
          startedAt,
          rowCount: mappedRows.length,
          scopeType: firstPage.scopeMeta.scopeType,
          attributionMode: firstPage.scopeMeta.attributionMode,
          resolvedCounterpartyCount: firstPage.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return toReportCsvResponse(c, {
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
          rows: mappedRows,
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(listBalanceSheetRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result = await ctx.accountingReportingService.listBalanceSheet(query);
        const payload = mapBalanceSheetDto(result);

        logReportMetrics(ctx, {
          reportKey: "balance-sheet",
          startedAt,
          rowCount: payload.data.length,
          scopeType: payload.scopeMeta.scopeType,
          attributionMode: payload.scopeMeta.attributionMode,
          resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return c.json(payload, 200);
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(exportBalanceSheetRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result = await ctx.accountingReportingService.listBalanceSheet(query);
        const payload = mapBalanceSheetDto(result);

        logReportMetrics(ctx, {
          reportKey: "balance-sheet",
          startedAt,
          rowCount: payload.data.length,
          scopeType: payload.scopeMeta.scopeType,
          attributionMode: payload.scopeMeta.attributionMode,
          resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return toReportCsvResponse(c, {
          filename: "balance-sheet.csv",
          headers: ["section", "lineCode", "lineLabel", "currency", "amount"],
          rows: payload.data,
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(listIncomeStatementRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result = await ctx.accountingReportingService.listIncomeStatement(query);
        const payload = mapIncomeStatementDto(result);

        logReportMetrics(ctx, {
          reportKey: "income-statement",
          startedAt,
          rowCount: payload.data.length,
          scopeType: payload.scopeMeta.scopeType,
          attributionMode: payload.scopeMeta.attributionMode,
          resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return c.json(payload, 200);
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(exportIncomeStatementRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result = await ctx.accountingReportingService.listIncomeStatement(query);
        const payload = mapIncomeStatementDto(result);

        logReportMetrics(ctx, {
          reportKey: "income-statement",
          startedAt,
          rowCount: payload.data.length,
          scopeType: payload.scopeMeta.scopeType,
          attributionMode: payload.scopeMeta.attributionMode,
          resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return toReportCsvResponse(c, {
          filename: "income-statement.csv",
          headers: ["section", "lineCode", "lineLabel", "currency", "amount"],
          rows: payload.data,
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(listCashFlowRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result = await ctx.accountingReportingService.listCashFlow(query);
        const payload = mapCashFlowDto(result);

        logReportMetrics(ctx, {
          reportKey: "cash-flow",
          startedAt,
          rowCount: payload.data.length,
          scopeType: payload.scopeMeta.scopeType,
          attributionMode: payload.scopeMeta.attributionMode,
          resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return c.json(payload, 200);
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(exportCashFlowRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result = await ctx.accountingReportingService.listCashFlow(query);
        const payload = mapCashFlowDto(result);

        logReportMetrics(ctx, {
          reportKey: "cash-flow",
          startedAt,
          rowCount: payload.data.length,
          scopeType: payload.scopeMeta.scopeType,
          attributionMode: payload.scopeMeta.attributionMode,
          resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return toReportCsvResponse(c, {
          filename: "cash-flow.csv",
          headers: ["section", "lineCode", "lineLabel", "currency", "amount"],
          rows: payload.data,
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(listLiquidityRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result = await ctx.accountingReportingService.listLiquidity(query);
        const payload = mapLiquidityDto(result);

        logReportMetrics(ctx, {
          reportKey: "liquidity",
          startedAt,
          rowCount: payload.data.length,
          scopeType: payload.scopeMeta.scopeType,
          attributionMode: payload.scopeMeta.attributionMode,
          resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return c.json(payload, 200);
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(exportLiquidityRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const firstPage = await ctx.accountingReportingService.listLiquidity({
          ...query,
          limit: 200,
          offset: 0,
        });
        const rows = await readAllPages(firstPage, ({ limit, offset }) =>
          ctx.accountingReportingService.listLiquidity({
            ...query,
            limit,
            offset,
          }),
        );
        const mappedRows = mapLiquidityDto({
          ...firstPage,
          data: rows,
        }).data;

        logReportMetrics(ctx, {
          reportKey: "liquidity",
          startedAt,
          rowCount: mappedRows.length,
          scopeType: firstPage.scopeMeta.scopeType,
          attributionMode: firstPage.scopeMeta.attributionMode,
          resolvedCounterpartyCount: firstPage.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return toReportCsvResponse(c, {
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
          rows: mappedRows,
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(listFxRevaluationRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result = await ctx.accountingReportingService.listFxRevaluation(query);
        const payload = mapFxRevaluationDto(result);

        logReportMetrics(ctx, {
          reportKey: "fx-revaluation",
          startedAt,
          rowCount: payload.data.length,
          scopeType: payload.scopeMeta.scopeType,
          attributionMode: payload.scopeMeta.attributionMode,
          resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return c.json(payload, 200);
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(exportFxRevaluationRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result = await ctx.accountingReportingService.listFxRevaluation(query);
        const payload = mapFxRevaluationDto(result);

        logReportMetrics(ctx, {
          reportKey: "fx-revaluation",
          startedAt,
          rowCount: payload.data.length,
          scopeType: payload.scopeMeta.scopeType,
          attributionMode: payload.scopeMeta.attributionMode,
          resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return toReportCsvResponse(c, {
          filename: "fx-revaluation.csv",
          headers: ["bucket", "currency", "revenue", "expense", "net"],
          rows: payload.data,
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(listFeeRevenueRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result =
          await ctx.accountingReportingService.listFeeRevenueBreakdown(query);
        const payload = mapFeeRevenueDto(result);

        logReportMetrics(ctx, {
          reportKey: "fee-revenue",
          startedAt,
          rowCount: payload.data.length,
          scopeType: payload.scopeMeta.scopeType,
          attributionMode: payload.scopeMeta.attributionMode,
          resolvedCounterpartyCount: payload.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return c.json(payload, 200);
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(exportFeeRevenueRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const firstPage = await ctx.accountingReportingService.listFeeRevenueBreakdown({
          ...query,
          limit: 200,
          offset: 0,
        });
        const rows = await readAllPages(firstPage, ({ limit, offset }) =>
          ctx.accountingReportingService.listFeeRevenueBreakdown({
            ...query,
            limit,
            offset,
          }),
        );
        const mappedRows = mapFeeRevenueDto({
          ...firstPage,
          data: rows,
        }).data;

        logReportMetrics(ctx, {
          reportKey: "fee-revenue",
          startedAt,
          rowCount: mappedRows.length,
          scopeType: firstPage.scopeMeta.scopeType,
          attributionMode: firstPage.scopeMeta.attributionMode,
          resolvedCounterpartyCount: firstPage.scopeMeta.resolvedCounterpartyIdsCount,
        });

        return toReportCsvResponse(c, {
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
          rows: mappedRows,
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(getClosePackageRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result = await ctx.accountingReportingService.listClosePackage(query);
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
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(exportClosePackageRoute, async (c) => {
      try {
        const startedAt = Date.now();
        const query = c.req.valid("query");
        const result = await ctx.accountingReportingService.listClosePackage(query);
        const payload = mapClosePackageDto(result);

        const rows: Record<string, unknown>[] = [
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
        ];

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
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    });
}

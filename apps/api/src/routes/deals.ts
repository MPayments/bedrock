import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, between, count, eq, gte, inArray, lte, sql, sum } from "drizzle-orm";

import { CalculationDetailsSchema } from "@bedrock/calculations/contracts";
import { currencies as currenciesTable } from "@bedrock/currencies/schema";
import {
  CreateDealInputSchema,
  DealCalculationHistoryItemSchema,
  DealDetailsSchema,
  DealTraceSchema,
  DealWorkflowProjectionSchema,
  ListDealsQuerySchema,
  PaginatedDealsSchema,
  ReplaceDealIntakeInputSchema,
  TransitionDealStatusInputSchema,
  UpdateDealLegStateInputSchema,
  UpdateDealIntakeInputSchema,
} from "@bedrock/deals/contracts";
import {
  dealIntakeSnapshots as dealIntakeSnapshotsTable,
  deals as dealsTable,
} from "@bedrock/deals/schema";
import { FileAttachmentSchema } from "@bedrock/files/contracts";
import { customers as customersTable } from "@bedrock/parties/schema";
import {
  PreviewQuoteInputSchema,
  QuoteListItemSchema,
  QuoteSchema,
} from "@bedrock/treasury/contracts";

import { DeletedSchema, ErrorSchema, IdParamSchema } from "../common";
import { handleRouteError } from "../common/errors";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import { db } from "../db/client";
import type { AuthVariables } from "../middleware/auth";
import {
  getRequestContext,
  withRequiredIdempotency,
} from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";
import {
  buildDealTrace,
  createDealScopedFormalDocument,
  createDealScopedQuote,
  DealScopedCreateDocumentInputSchema,
  assertDealAllowsCommercialWrite,
  requireDeal,
} from "./internal/deal-linked-resources";
import { toDocumentDto } from "./internal/document-dto";
import {
  serializeQuote,
  serializeQuoteListItem,
} from "./internal/treasury-quote-dto";

export function dealsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const DealAttachmentParamsSchema = IdParamSchema.extend({
    attachmentId: z.string().uuid().openapi({
      param: {
        in: "path",
        name: "attachmentId",
      },
    }),
  });
  const DealQuoteParamsSchema = IdParamSchema.extend({
    quoteId: z.string().uuid().openapi({
      param: {
        in: "path",
        name: "quoteId",
      },
    }),
  });
  const DealLegParamsSchema = IdParamSchema.extend({
    idx: z.coerce.number().int().positive().openapi({
      param: {
        in: "path",
        name: "idx",
      },
    }),
  });
  const DealCalculationHistorySchema = z.array(DealCalculationHistoryItemSchema);
  const DealCalculationFromQuoteInputSchema = z.object({
    quoteId: z.string().uuid(),
  });

  const listRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Deals"],
    summary: "List deals",
    request: {
      query: ListDealsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedDealsSchema,
          },
        },
        description: "Paginated deals",
      },
    },
  });

  const statsRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/stats",
    tags: ["Deals"],
    summary: "Get deal statistics for a date range",
    request: {
      query: z.object({
        dateFrom: z.string().date(),
        dateTo: z.string().date(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              totalCount: z.number().int(),
              byStatus: z.record(z.string(), z.number().int()),
              totalAmount: z.string(),
            }),
          },
        },
        description: "Deal statistics",
      },
    },
  });

  const DealByStatusItemSchema = z.object({
    id: z.string().uuid(),
    client: z.string(),
    amount: z.number(),
    currency: z.string(),
    amountInBase: z.number(),
    baseCurrencyCode: z.string(),
    status: z.string(),
    createdAt: z.string(),
    comment: z.string().optional(),
  });

  const byStatusRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/by-status",
    tags: ["Deals"],
    summary: "Get active deals grouped by status buckets",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              pending: z.array(DealByStatusItemSchema),
              inProgress: z.array(DealByStatusItemSchema),
              done: z.array(DealByStatusItemSchema),
            }),
          },
        },
        description: "Deals grouped by status",
      },
    },
  });

  const byDayRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/by-day",
    tags: ["Deals"],
    summary: "Get daily deal aggregation for charts",
    request: {
      query: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        statuses: z.string().optional(),
        currencies: z.string().optional(),
        customerId: z.string().uuid().optional(),
        agentId: z.string().optional(),
        reportCurrencyCode: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                date: z.string(),
                amount: z.number(),
                count: z.number(),
                closedCount: z.number(),
                closedAmount: z.number(),
              }).passthrough(),
            ),
          },
        },
        description: "Daily deal aggregation",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Deals"],
    summary: "Get deal by id",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealDetailsSchema,
          },
        },
        description: "Deal found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Deal not found",
      },
    },
  });

  const getWorkflowRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/workflow",
    tags: ["Deals"],
    summary: "Get deal workflow projection",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealWorkflowProjectionSchema,
          },
        },
        description: "Deal workflow projection",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Deal not found",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ deals: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Deals"],
    summary: "Create draft deal",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateDealInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: DealDetailsSchema,
          },
        },
        description: "Deal created",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation or idempotency header error",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Referenced entity not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Idempotency conflict",
      },
    },
  });

  const updateIntakeRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "patch",
    path: "/{id}/intake",
    tags: ["Deals"],
    summary: "Update deal intake fields",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateDealIntakeInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: DealDetailsSchema } },
        description: "Deal updated",
      },
    },
  });

  const replaceIntakeRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "put",
    path: "/{id}/intake",
    tags: ["Deals"],
    summary: "Replace the full typed deal intake snapshot",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: ReplaceDealIntakeInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: DealWorkflowProjectionSchema } },
        description: "Deal workflow updated",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Deal revision conflict",
      },
    },
  });

  const acceptQuoteRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/quotes/{quoteId}/accept",
    tags: ["Deals"],
    summary: "Accept the active executable quote for the current deal revision",
    request: {
      params: DealQuoteParamsSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealWorkflowProjectionSchema,
          },
        },
        description: "Quote accepted",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Deal or quote not found",
      },
    },
  });

  const listCalculationHistoryRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/calculations",
    tags: ["Deals"],
    summary: "List deal calculation history",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealCalculationHistorySchema,
          },
        },
        description: "Deal calculation history",
      },
    },
  });

  const createCalculationFromQuoteRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/calculations/from-quote",
    tags: ["Deals"],
    summary: "Create a calculation from a treasury quote and attach to deal",
    request: {
      params: IdParamSchema,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: DealCalculationFromQuoteInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: CalculationDetailsSchema,
          },
        },
        description: "Calculation created and attached",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation or idempotency header error",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Deal or quote not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Idempotency conflict",
      },
    },
  });

  const transitionStatusRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "patch",
    path: "/{id}/status",
    tags: ["Deals"],
    summary: "Transition deal status",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: TransitionDealStatusInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: DealWorkflowProjectionSchema } },
        description: "Deal status updated",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Transition blocked",
      },
    },
  });

  const updateLegStateRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/legs/{idx}/state",
    tags: ["Deals"],
    summary: "Update execution leg state",
    request: {
      params: DealLegParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateDealLegStateInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: DealWorkflowProjectionSchema } },
        description: "Execution leg state updated",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Leg state transition blocked",
      },
    },
  });

  const listQuotesRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/quotes",
    tags: ["Deals"],
    summary: "List treasury quotes linked to a deal",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(QuoteListItemSchema),
          },
        },
        description: "Deal quotes",
      },
    },
  });

  const createQuoteRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/quotes",
    tags: ["Deals"],
    summary: "Create a treasury quote for a deal",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: PreviewQuoteInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: QuoteSchema,
          },
        },
        description: "Quote created",
      },
    },
  });

  const listFormalDocumentsRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/formal-documents",
    tags: ["Deals"],
    summary: "List formal documents linked to a deal",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(z.any()),
          },
        },
        description: "Deal formal documents",
      },
    },
  });

  const createFormalDocumentRoute = createRoute({
    middleware: [
      requirePermission({ deals: ["update"] }),
      requirePermission({ documents: ["create"] }),
    ],
    method: "post",
    path: "/{id}/formal-documents/{docType}",
    tags: ["Deals"],
    summary: "Create a formal document for a deal",
    request: {
      params: IdParamSchema.extend({
        docType: z.string().min(1),
      }),
      body: {
        content: {
          "application/json": {
            schema: DealScopedCreateDocumentInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.any(),
          },
        },
        description: "Formal document created",
      },
    },
  });

  const listAttachmentsRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/attachments",
    tags: ["Deals"],
    summary: "List uploaded attachments for a deal",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(FileAttachmentSchema),
          },
        },
        description: "Deal attachments",
      },
    },
  });

  const uploadAttachmentRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/attachments",
    tags: ["Deals"],
    summary: "Upload an attachment for a deal",
    request: {
      params: IdParamSchema,
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: FileAttachmentSchema,
          },
        },
        description: "Deal attachment uploaded",
      },
    },
  });

  const downloadAttachmentRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/attachments/{attachmentId}/download",
    tags: ["Deals"],
    summary: "Download an uploaded deal attachment",
    request: {
      params: DealAttachmentParamsSchema,
    },
    responses: {
      302: {
        description: "Redirect to signed download URL",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Attachment not found",
      },
    },
  });

  const deleteAttachmentRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "delete",
    path: "/{id}/attachments/{attachmentId}",
    tags: ["Deals"],
    summary: "Delete an uploaded deal attachment",
    request: {
      params: DealAttachmentParamsSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DeletedSchema,
          },
        },
        description: "Deal attachment deleted",
      },
    },
  });

  const traceRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/trace",
    tags: ["Deals"],
    summary: "Get end-to-end deal trace",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealTraceSchema,
          },
        },
        description: "Deal trace",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await ctx.dealsModule.deals.queries.list(query);
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(statsRoute, async (c) => {
      try {
        const { dateFrom, dateTo } = c.req.valid("query");
        const from = new Date(`${dateFrom}T00:00:00Z`);
        const to = new Date(`${dateTo}T23:59:59.999Z`);

        const rows = await db
          .select({
            status: dealsTable.status,
            count: count(),
            total: sum(dealsTable.sourceAmountMinor),
          })
          .from(dealsTable)
          .where(
            and(
              between(dealsTable.createdAt, from, to),
            ),
          )
          .groupBy(dealsTable.status);

        let totalCount = 0;
        let totalAmount = BigInt(0);
        const byStatus: Record<string, number> = {};

        for (const row of rows) {
          totalCount += row.count;
          byStatus[row.status] = row.count;
          if (row.total) {
            totalAmount += BigInt(row.total);
          }
        }

        return jsonOk(c, {
          totalCount,
          byStatus,
          totalAmount: totalAmount.toString(),
        });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(byStatusRoute, async (c) => {
      try {
        const PENDING_STATUSES = ["awaiting_funds"] as const;
        const IN_PROGRESS_STATUSES = ["draft", "submitted", "preparing_documents", "awaiting_payment"] as const;
        const DONE_STATUSES = ["closing_documents", "done"] as const;

        const allStatuses = [...PENDING_STATUSES, ...IN_PROGRESS_STATUSES, ...DONE_STATUSES];

        const rows = await db
          .select({
            id: dealsTable.id,
            status: dealsTable.status,
            sourceAmountMinor: dealsTable.sourceAmountMinor,
            sourceCurrencyId: dealsTable.sourceCurrencyId,
            customerId: dealsTable.customerId,
            createdAt: dealsTable.createdAt,
            intakeSnapshot: dealIntakeSnapshotsTable.snapshot,
            customerName: customersTable.displayName,
            currencyCode: currenciesTable.code,
          })
          .from(dealsTable)
          .leftJoin(
            dealIntakeSnapshotsTable,
            eq(dealsTable.id, dealIntakeSnapshotsTable.dealId),
          )
          .leftJoin(customersTable, eq(dealsTable.customerId, customersTable.id))
          .leftJoin(currenciesTable, eq(dealsTable.sourceCurrencyId, currenciesTable.id))
          .where(inArray(dealsTable.status, allStatuses))
          .orderBy(dealsTable.createdAt);

        function toDealItem(row: typeof rows[number]) {
          const amountMinor = row.sourceAmountMinor ? Number(row.sourceAmountMinor) : 0;
          const amount = amountMinor / 100;
          const comment =
            row.intakeSnapshot?.common.customerNote ??
            row.intakeSnapshot?.moneyRequest.purpose ??
            undefined;

          return {
            id: row.id,
            client: row.customerName ?? "—",
            amount,
            currency: row.currencyCode ?? "RUB",
            amountInBase: amount,
            baseCurrencyCode: "RUB",
            status: row.status,
            createdAt: row.createdAt.toISOString(),
            ...(comment ? { comment } : {}),
          };
        }

        const pending = rows
          .filter((r) => (PENDING_STATUSES as readonly string[]).includes(r.status))
          .map(toDealItem);
        const inProgress = rows
          .filter((r) => (IN_PROGRESS_STATUSES as readonly string[]).includes(r.status))
          .map(toDealItem);
        const done = rows
          .filter((r) => (DONE_STATUSES as readonly string[]).includes(r.status))
          .map(toDealItem);

        return jsonOk(c, { pending, inProgress, done });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(byDayRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const conditions = [];

        if (query.dateFrom) {
          conditions.push(gte(dealsTable.createdAt, new Date(query.dateFrom)));
        }
        if (query.dateTo) {
          conditions.push(lte(dealsTable.createdAt, new Date(query.dateTo)));
        }
        if (query.customerId) {
          conditions.push(eq(dealsTable.customerId, query.customerId));
        }
        if (query.agentId) {
          conditions.push(eq(dealsTable.agentId, query.agentId));
        }
        if (query.statuses) {
          const statusList = query.statuses.split(",") as (typeof dealsTable.status.enumValues)[number][];
          conditions.push(inArray(dealsTable.status, statusList));
        }

        const rows = await db
          .select({
            date: sql<string>`to_char(${dealsTable.createdAt}, 'YYYY-MM-DD')`,
            status: dealsTable.status,
            currencyCode: currenciesTable.code,
            count: count(),
            total: sum(dealsTable.sourceAmountMinor),
          })
          .from(dealsTable)
          .leftJoin(currenciesTable, eq(dealsTable.sourceCurrencyId, currenciesTable.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .groupBy(
            sql`to_char(${dealsTable.createdAt}, 'YYYY-MM-DD')`,
            dealsTable.status,
            currenciesTable.code,
          )
          .orderBy(sql`to_char(${dealsTable.createdAt}, 'YYYY-MM-DD')`);

        const dayMap = new Map<string, {
          date: string;
          amount: number;
          count: number;
          closedCount: number;
          closedAmount: number;
          [currency: string]: string | number;
        }>();

        for (const row of rows) {
          const date = row.date;
          if (!dayMap.has(date)) {
            dayMap.set(date, { date, amount: 0, count: 0, closedCount: 0, closedAmount: 0 });
          }
          const day = dayMap.get(date)!;
          const totalMinor = row.total ? Number(row.total) / 100 : 0;

          day.count += row.count;
          day.amount += totalMinor;

          if (row.status === "done") {
            day.closedCount += row.count;
            day.closedAmount += totalMinor;
          }

          if (row.currencyCode) {
            day[row.currencyCode] = ((day[row.currencyCode] as number) || 0) + totalMinor;
          }
        }

        return jsonOk(c, Array.from(dayMap.values()));
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await ctx.dealsModule.deals.queries.findById(id);
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getWorkflowRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await ctx.dealsModule.deals.queries.findWorkflowById(id);
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createRoute_, async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.dealsModule.deals.commands.create({
            ...body,
            actorUserId: c.get("user")!.id,
            idempotencyKey,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(c, result, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(updateIntakeRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await ctx.dealsModule.deals.commands.updateIntake({
          ...body,
          actorUserId: c.get("user")!.id,
          dealId: id,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(replaceIntakeRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await ctx.dealsModule.deals.commands.replaceIntake({
          ...body,
          actorUserId: c.get("user")!.id,
          dealId: id,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(acceptQuoteRoute, async (c) => {
      try {
        const { id, quoteId } = c.req.valid("param");
        const result = await ctx.dealsModule.deals.commands.acceptQuote({
          actorUserId: c.get("user")!.id,
          dealId: id,
          quoteId,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listCalculationHistoryRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        await requireDeal(ctx, id);
        const history =
          await ctx.dealsModule.deals.queries.listCalculationHistory(id);
        return jsonOk(c, history);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createCalculationFromQuoteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, async (idempotencyKey) => {
          const deal = await requireDeal(ctx, id);
          assertDealAllowsCommercialWrite(deal);
          return ctx.dealQuoteWorkflow.createCalculationFromAcceptedQuote({
            actorUserId: c.get("user")!.id,
            dealId: id,
            idempotencyKey,
            quoteId: body.quoteId,
          });
        });

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(c, result, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(transitionStatusRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await ctx.dealsModule.deals.commands.transitionStatus({
          ...body,
          actorUserId: c.get("user")!.id,
          dealId: id,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(updateLegStateRoute, async (c) => {
      try {
        const { id, idx } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await ctx.dealsModule.deals.commands.updateLegState({
          ...body,
          actorUserId: c.get("user")!.id,
          dealId: id,
          idx,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listQuotesRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        await requireDeal(ctx, id);
        const result = await ctx.treasuryModule.quotes.queries.listQuotes({
          dealId: id,
          limit: 500,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        });

        return jsonOk(
          c,
          result.data.map((quote) => serializeQuoteListItem(quote)),
        );
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createQuoteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          createDealScopedQuote({
            body,
            ctx,
            dealId: id,
            idempotencyKey,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        await ctx.dealsModule.deals.commands.appendTimelineEvent({
          actorUserId: c.get("user")!.id,
          dealId: id,
          payload: {
            expiresAt: result.expiresAt,
            quoteId: result.id,
          },
          sourceRef: `quote:${result.id}:created`,
          type: "quote_created",
          visibility: "internal",
        });

        return jsonOk(c, serializeQuote(result), 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listFormalDocumentsRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        await requireDeal(ctx, id);
        const result = await ctx.documentsService.list(
          {
            dealId: id,
            limit: 200,
            offset: 0,
            sortBy: "occurredAt",
            sortOrder: "desc",
          },
          c.get("user")!.id,
        );

        return jsonOk(c, result.data.map((document) => toDocumentDto(document)));
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createFormalDocumentRoute, async (c) => {
      try {
        const { docType, id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          createDealScopedFormalDocument({
            actorUserId: c.get("user")!.id,
            body,
            ctx,
            dealId: id,
            docType,
            idempotencyKey,
            requestContext: getRequestContext(c),
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        await ctx.dealsModule.deals.commands.appendTimelineEvent({
          actorUserId: c.get("user")!.id,
          dealId: id,
          payload: {
            docType,
            documentId: result.id,
          },
          sourceRef: `document:${result.id}:created`,
          type: "document_created",
          visibility: "internal",
        });

        return jsonOk(c, toDocumentDto(result), 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listAttachmentsRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        await requireDeal(ctx, id);
        const attachments =
          await ctx.filesModule.files.queries.listDealAttachments(id);
        return jsonOk(c, attachments);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(uploadAttachmentRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        await requireDeal(ctx, id);

        const body = await c.req.parseBody();
        const file = body.file;
        if (!file || typeof file === "string") {
          return c.json({ error: "File is required" }, 400 as const);
        }

        const attachment =
          await ctx.filesModule.files.commands.uploadDealAttachment({
            buffer: Buffer.from(await file.arrayBuffer()),
            description:
              typeof body.description === "string" ? body.description : null,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            ownerId: id,
            uploadedBy: c.get("user")!.id,
          });

        await ctx.dealsModule.deals.commands.appendTimelineEvent({
          actorUserId: c.get("user")!.id,
          dealId: id,
          payload: {
            attachmentId: attachment.id,
            fileName: attachment.fileName,
          },
          sourceRef: `attachment:${attachment.id}:uploaded`,
          type: "attachment_uploaded",
          visibility: "internal",
        });

        return jsonOk(c, attachment, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(downloadAttachmentRoute, async (c) => {
      try {
        const { attachmentId, id } = c.req.valid("param");
        await requireDeal(ctx, id);
        const url =
          await ctx.filesModule.files.queries.getDealAttachmentDownloadUrl({
            fileAssetId: attachmentId,
            ownerId: id,
          });
        return c.redirect(url, 302);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(deleteAttachmentRoute, async (c) => {
      try {
        const { attachmentId, id } = c.req.valid("param");
        await requireDeal(ctx, id);
        await ctx.filesModule.files.commands.deleteDealAttachment({
          fileAssetId: attachmentId,
          ownerId: id,
        });

        await ctx.dealsModule.deals.commands.appendTimelineEvent({
          actorUserId: c.get("user")!.id,
          dealId: id,
          payload: {
            attachmentId,
          },
          sourceRef: `attachment:${attachmentId}:deleted`,
          type: "attachment_deleted",
          visibility: "internal",
        });

        return jsonOk(c, { deleted: true });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(traceRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const trace = await buildDealTrace(ctx, id);
        return jsonOk(c, trace);
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}

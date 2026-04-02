import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  and,
  between,
  count,
  eq,
  gte,
  inArray,
  lte,
  sql,
  sum,
} from "drizzle-orm";

import { CalculationDetailsSchema } from "@bedrock/calculations/contracts";
import { currencies as currenciesTable } from "@bedrock/currencies/schema";
import {
  AssignDealAgentInputSchema,
  CreateDealInputSchema,
  CreateDealDraftInputSchema,
  DealAttachmentIngestionSchema,
  DealCalculationHistoryItemSchema,
  DealDetailsSchema,
  DealTraceSchema,
  DealWorkflowProjectionSchema,
  ReplaceDealIntakeInputSchema,
  TransitionDealStatusInputSchema,
  UpdateDealAgreementInputSchema,
  UpdateDealLegStateInputSchema,
  UpdateDealIntakeInputSchema,
} from "@bedrock/deals/contracts";
import {
  dealIntakeSnapshots as dealIntakeSnapshotsTable,
  deals as dealsTable,
} from "@bedrock/deals/schema";
import {
  FileAttachmentPurposeSchema,
  FileAttachmentSchema,
  FileAttachmentVisibilitySchema,
} from "@bedrock/files/contracts";
import { customers as customersTable } from "@bedrock/parties/schema";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import { minorToAmountString } from "@bedrock/shared/money";
import {
  PreviewQuoteInputSchema,
  QuoteListItemSchema,
  QuoteSchema,
} from "@bedrock/treasury/contracts";
import {
  CrmDealBoardProjectionSchema,
  CrmDealWorkbenchProjectionSchema,
  FinanceDealQueueFiltersSchema,
  FinanceDealQueueProjectionSchema,
  FinanceDealWorkspaceProjectionSchema,
} from "@bedrock/workflow-deal-projections/contracts";

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

const CRM_DEALS_SORT_COLUMNS = [
  "id",
  "createdAt",
  "client",
  "amount",
  "amountInBase",
  "closedAt",
  "agentName",
] as const;

const CrmDealsListQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_QUERY_LIST_LIMIT).default(20),
  sortBy: z.enum(CRM_DEALS_SORT_COLUMNS).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  statuses: z.string().optional(),
  currencies: z.string().optional(),
  customerId: z.string().uuid().optional(),
  agentId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  qClient: z.string().trim().min(1).optional(),
  qComment: z.string().trim().min(1).optional(),
});

const CrmDealListItemSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
  client: z.string(),
  clientId: z.string().uuid(),
  amount: z.number(),
  currency: z.string(),
  amountInBase: z.number(),
  baseCurrencyCode: z.string(),
  status: z.string(),
  agentName: z.string(),
  comment: z.string().optional(),
  feePercentage: z.number(),
});

const CrmDealsListResponseSchema = z.object({
  data: z.array(CrmDealListItemSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

type CrmDealListItem = z.infer<typeof CrmDealListItemSchema>;

function parseOptionalSet(value?: string): Set<string> | null {
  if (!value) {
    return null;
  }

  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? new Set(items) : null;
}

function parseDecimalOrZero(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMinorOrZero(
  value: string | bigint | null | undefined,
  precision: number | null | undefined,
): number {
  if (value == null || precision == null) {
    return 0;
  }

  return parseDecimalOrZero(minorToAmountString(value, { precision }));
}

function compareNullableStrings(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  return (left ?? "").localeCompare(right ?? "", "ru");
}

function compareNullableDates(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  const leftValue = left ? new Date(left).getTime() : 0;
  const rightValue = right ? new Date(right).getTime() : 0;
  return leftValue - rightValue;
}

export function dealsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const DealAttachmentParamsSchema = IdParamSchema.extend({
    attachmentId: z
      .string()
      .uuid()
      .openapi({
        param: {
          in: "path",
          name: "attachmentId",
        },
      }),
  });
  const DealQuoteParamsSchema = IdParamSchema.extend({
    quoteId: z
      .string()
      .uuid()
      .openapi({
        param: {
          in: "path",
          name: "quoteId",
        },
      }),
  });
  const DealLegParamsSchema = IdParamSchema.extend({
    idx: z.coerce
      .number()
      .int()
      .positive()
      .openapi({
        param: {
          in: "path",
          name: "idx",
        },
      }),
  });
  const DealCalculationHistorySchema = z.array(
    DealCalculationHistoryItemSchema,
  );
  const DealCalculationFromQuoteInputSchema = z.object({
    quoteId: z.string().uuid(),
  });
  const DealAttachmentVisibilityInputSchema = z.object({
    visibility: FileAttachmentVisibilitySchema.optional(),
  });
  const DealAttachmentPurposeInputSchema = z.object({
    purpose: FileAttachmentPurposeSchema,
  });

  const listRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Deals"],
    summary: "List deals",
    request: {
      query: CrmDealsListQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CrmDealsListResponseSchema,
          },
        },
        description: "Paginated CRM deals",
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
              z
                .object({
                  date: z.string(),
                  amount: z.number(),
                  count: z.number(),
                  closedCount: z.number(),
                  closedAmount: z.number(),
                })
                .passthrough(),
            ),
          },
        },
        description: "Daily deal aggregation",
      },
    },
  });

  const financeQueuesRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/finance/queues",
    tags: ["Deals"],
    summary: "List finance deal queues",
    request: {
      query: FinanceDealQueueFiltersSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: FinanceDealQueueProjectionSchema,
          },
        },
        description: "Finance deal queues",
      },
    },
  });

  const crmBoardRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/crm-board",
    tags: ["Deals"],
    summary: "List CRM deal board projection",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CrmDealBoardProjectionSchema,
          },
        },
        description: "CRM deal board projection",
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

  const getCrmWorkbenchRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/crm-workbench",
    tags: ["Deals"],
    summary: "Get CRM deal workbench projection",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CrmDealWorkbenchProjectionSchema,
          },
        },
        description: "CRM deal workbench projection",
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

  const getFinanceWorkspaceRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/finance-workspace",
    tags: ["Deals"],
    summary: "Get finance deal workspace projection",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: FinanceDealWorkspaceProjectionSchema,
          },
        },
        description: "Finance deal workspace projection",
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

  const createDraftRoute = createRoute({
    middleware: [requirePermission({ deals: ["create"] })],
    method: "post",
    path: "/drafts",
    tags: ["Deals"],
    summary: "Create typed draft deal for CRM",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateDealDraftInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: DealWorkflowProjectionSchema,
          },
        },
        description: "Typed deal draft created",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation or idempotency header error",
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
        content: {
          "application/json": { schema: DealWorkflowProjectionSchema },
        },
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

  const updateAgreementRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "patch",
    path: "/{id}/agreement",
    tags: ["Deals"],
    summary: "Change effective agreement for a draft deal",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateDealAgreementInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: DealWorkflowProjectionSchema },
        },
        description: "Deal agreement updated",
      },
    },
  });

  const assignAgentRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "patch",
    path: "/{id}/assignee",
    tags: ["Deals"],
    summary: "Assign or unassign CRM agent for a deal",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: AssignDealAgentInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: DealWorkflowProjectionSchema },
        },
        description: "Deal assignee updated",
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
        content: {
          "application/json": { schema: DealWorkflowProjectionSchema },
        },
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
        content: {
          "application/json": { schema: DealWorkflowProjectionSchema },
        },
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

  const reingestAttachmentRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/attachments/{attachmentId}/reingest",
    tags: ["Deals"],
    summary: "Requeue deal attachment ingestion",
    request: {
      params: DealAttachmentParamsSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealAttachmentIngestionSchema,
          },
        },
        description: "Attachment ingestion requeued",
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
    .openapi(financeQueuesRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result =
          await ctx.dealProjectionsWorkflow.listFinanceDealQueues(query);
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(crmBoardRoute, async (c) => {
      try {
        const result = await ctx.dealProjectionsWorkflow.listCrmDealBoard();
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const requestedStatuses = parseOptionalSet(query.statuses);
        const requestedCurrencies = parseOptionalSet(query.currencies);
        const listedDeals: Awaited<
          ReturnType<typeof ctx.dealsModule.deals.queries.list>
        >["data"] = [];

        let offset = 0;
        let total = 0;

        do {
          const page = await ctx.dealsModule.deals.queries.list({
            customerId: query.customerId,
            limit: MAX_QUERY_LIST_LIMIT,
            offset,
            sortBy: "createdAt",
            sortOrder: "desc",
          });

          listedDeals.push(...page.data);
          total = page.total;
          offset += page.limit;
        } while (offset < total);

        const customerIds = [
          ...new Set(listedDeals.map((deal) => deal.customerId)),
        ];
        const agentIds = [
          ...new Set(
            listedDeals
              .map((deal) => deal.agentId)
              .filter((agentId): agentId is string => Boolean(agentId)),
          ),
        ];
        const calculationIds = [
          ...new Set(
            listedDeals
              .map((deal) => deal.calculationId)
              .filter((calculationId): calculationId is string =>
                Boolean(calculationId),
              ),
          ),
        ];
        const requestedCurrencyIds = [
          ...new Set(
            listedDeals
              .map((deal) => deal.requestedCurrencyId)
              .filter((currencyId): currencyId is string =>
                Boolean(currencyId),
              ),
          ),
        ];

        const [
          customersById,
          agentsById,
          calculationsById,
          requestedCurrenciesById,
        ] = await Promise.all([
          Promise.all(
            customerIds.map(async (customerId) => [
              customerId,
              await ctx.partiesModule.customers.queries.findById(customerId),
            ]),
          ).then((entries) => new Map(entries)),
          Promise.all(
            agentIds.map(async (agentId) => [
              agentId,
              await ctx.iamService.queries.findById(agentId),
            ]),
          ).then((entries) => new Map(entries)),
          Promise.all(
            calculationIds.map(async (calculationId) => [
              calculationId,
              await ctx.calculationsModule.calculations.queries.findById(
                calculationId,
              ),
            ]),
          ).then((entries) => new Map(entries)),
          Promise.all(
            requestedCurrencyIds.map(async (currencyId) => [
              currencyId,
              await ctx.currenciesService.findById(currencyId),
            ]),
          ).then((entries) => new Map(entries)),
        ]);

        const baseCurrencyIds = [
          ...new Set(
            [...calculationsById.values()]
              .map((calculation) => calculation?.currentSnapshot.baseCurrencyId)
              .filter((currencyId): currencyId is string =>
                Boolean(currencyId),
              ),
          ),
        ];
        const baseCurrenciesById = new Map(
          await Promise.all(
            baseCurrencyIds.map(async (currencyId) => [
              currencyId,
              await ctx.currenciesService.findById(currencyId),
            ]),
          ),
        );

        const enrichedDeals = listedDeals.map(
          (
            deal,
          ): CrmDealListItem & {
            agentId: string | null;
            createdAtDate: number;
          } => {
            const customer = customersById.get(deal.customerId) ?? null;
            const calculation = deal.calculationId
              ? (calculationsById.get(deal.calculationId) ?? null)
              : null;
            const sourceCurrency = deal.requestedCurrencyId
              ? (requestedCurrenciesById.get(deal.requestedCurrencyId) ?? null)
              : null;
            const baseCurrency = calculation
              ? (baseCurrenciesById.get(
                  calculation.currentSnapshot.baseCurrencyId,
                ) ?? null)
              : null;
            const agent = deal.agentId
              ? (agentsById.get(deal.agentId) ?? null)
              : null;

            const amount = parseDecimalOrZero(deal.requestedAmount);
            const amountInBase = calculation
              ? baseCurrency
                ? parseMinorOrZero(
                    calculation.currentSnapshot.totalInBaseMinor,
                    baseCurrency.precision,
                  )
                : amount
              : amount;
            const feePercentage = calculation
              ? parseMinorOrZero(calculation.currentSnapshot.feeBps, 2)
              : 0;
            const currencyCode = sourceCurrency?.code ?? "RUB";
            const baseCurrencyCode = baseCurrency?.code ?? currencyCode;
            const closedAt =
              deal.status === "done" || deal.status === "cancelled"
                ? deal.updatedAt.toISOString()
                : null;
            const comment =
              deal.comment ?? deal.intakeComment ?? deal.reason ?? undefined;

            return {
              agentId: deal.agentId,
              agentName: agent?.name ?? "",
              amount,
              amountInBase,
              baseCurrencyCode,
              client: customer?.displayName ?? "—",
              clientId: deal.customerId,
              closedAt,
              comment,
              createdAt: deal.createdAt.toISOString(),
              createdAtDate: deal.createdAt.getTime(),
              currency: currencyCode,
              feePercentage,
              id: deal.id,
              status: deal.status,
              updatedAt: deal.updatedAt.toISOString(),
            };
          },
        );

        const filteredDeals = enrichedDeals.filter((deal) => {
          if (requestedStatuses && !requestedStatuses.has(deal.status)) {
            return false;
          }
          if (requestedCurrencies && !requestedCurrencies.has(deal.currency)) {
            return false;
          }
          if (query.agentId && deal.agentId !== query.agentId) {
            return false;
          }
          if (query.dateFrom && deal.createdAtDate < query.dateFrom.getTime()) {
            return false;
          }
          if (query.dateTo && deal.createdAtDate > query.dateTo.getTime()) {
            return false;
          }
          if (
            query.qClient &&
            !deal.client.toLowerCase().includes(query.qClient.toLowerCase())
          ) {
            return false;
          }
          if (
            query.qComment &&
            !(deal.comment ?? "")
              .toLowerCase()
              .includes(query.qComment.toLowerCase())
          ) {
            return false;
          }

          return true;
        });

        filteredDeals.sort((left, right) => {
          let comparison = 0;

          switch (query.sortBy) {
            case "id":
              comparison = left.id.localeCompare(right.id);
              break;
            case "client":
              comparison = compareNullableStrings(left.client, right.client);
              break;
            case "amount":
              comparison = left.amount - right.amount;
              break;
            case "amountInBase":
              comparison = left.amountInBase - right.amountInBase;
              break;
            case "closedAt":
              comparison = compareNullableDates(left.closedAt, right.closedAt);
              break;
            case "agentName":
              comparison = compareNullableStrings(
                left.agentName,
                right.agentName,
              );
              break;
            case "createdAt":
            default:
              comparison = left.createdAtDate - right.createdAtDate;
              break;
          }

          return query.sortOrder === "asc" ? comparison : -comparison;
        });

        const pagedDeals = filteredDeals
          .slice(query.offset, query.offset + query.limit)
          .map(
            ({ agentId: _agentId, createdAtDate: _createdAtDate, ...deal }) =>
              deal,
          );

        return jsonOk(c, {
          data: pagedDeals,
          limit: query.limit,
          offset: query.offset,
          total: filteredDeals.length,
        });
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
          .where(and(between(dealsTable.createdAt, from, to)))
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
        const IN_PROGRESS_STATUSES = [
          "draft",
          "submitted",
          "preparing_documents",
          "awaiting_payment",
        ] as const;
        const DONE_STATUSES = ["closing_documents", "done"] as const;

        const allStatuses = [
          ...PENDING_STATUSES,
          ...IN_PROGRESS_STATUSES,
          ...DONE_STATUSES,
        ];

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
          .leftJoin(
            customersTable,
            eq(dealsTable.customerId, customersTable.id),
          )
          .leftJoin(
            currenciesTable,
            eq(dealsTable.sourceCurrencyId, currenciesTable.id),
          )
          .where(inArray(dealsTable.status, allStatuses))
          .orderBy(dealsTable.createdAt);

        function toDealItem(row: (typeof rows)[number]) {
          const amountMinor = row.sourceAmountMinor
            ? Number(row.sourceAmountMinor)
            : 0;
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
          .filter((r) =>
            (PENDING_STATUSES as readonly string[]).includes(r.status),
          )
          .map(toDealItem);
        const inProgress = rows
          .filter((r) =>
            (IN_PROGRESS_STATUSES as readonly string[]).includes(r.status),
          )
          .map(toDealItem);
        const done = rows
          .filter((r) =>
            (DONE_STATUSES as readonly string[]).includes(r.status),
          )
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
          const statusList = query.statuses.split(
            ",",
          ) as (typeof dealsTable.status.enumValues)[number][];
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
          .leftJoin(
            currenciesTable,
            eq(dealsTable.sourceCurrencyId, currenciesTable.id),
          )
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .groupBy(
            sql`to_char(${dealsTable.createdAt}, 'YYYY-MM-DD')`,
            dealsTable.status,
            currenciesTable.code,
          )
          .orderBy(sql`to_char(${dealsTable.createdAt}, 'YYYY-MM-DD')`);

        const dayMap = new Map<
          string,
          {
            date: string;
            amount: number;
            count: number;
            closedCount: number;
            closedAmount: number;
            [currency: string]: string | number;
          }
        >();

        for (const row of rows) {
          const date = row.date;
          if (!dayMap.has(date)) {
            dayMap.set(date, {
              date,
              amount: 0,
              count: 0,
              closedCount: 0,
              closedAmount: 0,
            });
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
            day[row.currencyCode] =
              ((day[row.currencyCode] as number) || 0) + totalMinor;
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
    .openapi(getCrmWorkbenchRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result =
          await ctx.dealProjectionsWorkflow.getCrmDealWorkbenchProjection(id);

        if (!result) {
          return c.json({ error: `Deal ${id} not found` }, 404 as const);
        }

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getFinanceWorkspaceRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result =
          await ctx.dealProjectionsWorkflow.getFinanceDealWorkspaceProjection(
            id,
          );

        if (!result) {
          return c.json({ error: `Deal ${id} not found` }, 404 as const);
        }

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
    .openapi(createDraftRoute, async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.dealsModule.deals.commands.createDraft({
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
    .openapi(updateAgreementRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await ctx.dealsModule.deals.commands.updateAgreement({
          ...body,
          actorUserId: c.get("user")!.id,
          id,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(assignAgentRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await ctx.dealsModule.deals.commands.assignAgent({
          ...body,
          actorUserId: c.get("user")!.id,
          id,
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
        const result = await withRequiredIdempotency(
          c,
          async (idempotencyKey) => {
            const deal = await requireDeal(ctx, id);
            assertDealAllowsCommercialWrite(deal);
            return ctx.dealQuoteWorkflow.createCalculationFromAcceptedQuote({
              actorUserId: c.get("user")!.id,
              dealId: id,
              idempotencyKey,
              quoteId: body.quoteId,
            });
          },
        );

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
            limit: MAX_QUERY_LIST_LIMIT,
            offset: 0,
            sortBy: "occurredAt",
            sortOrder: "desc",
          },
          c.get("user")!.id,
        );

        return jsonOk(
          c,
          result.data.map((document) => toDocumentDto(document)),
        );
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

        const attachmentVisibilityResult =
          DealAttachmentVisibilityInputSchema.safeParse({
            visibility:
              typeof body.visibility === "string" ? body.visibility : undefined,
          });
        const attachmentPurposeResult =
          DealAttachmentPurposeInputSchema.safeParse({
            purpose:
              typeof body.purpose === "string" ? body.purpose : undefined,
          });

        if (!attachmentVisibilityResult.success) {
          return c.json(
            {
              error: "Attachment visibility must be customer_safe or internal",
            },
            400 as const,
          );
        }
        if (!attachmentPurposeResult.success) {
          return c.json(
            { error: "Attachment purpose must be invoice, contract, or other" },
            400 as const,
          );
        }

        const attachment =
          await ctx.filesModule.files.commands.uploadDealAttachment({
            attachmentPurpose: attachmentPurposeResult.data.purpose,
            attachmentVisibility:
              attachmentVisibilityResult.data.visibility ?? "internal",
            buffer: Buffer.from(await file.arrayBuffer()),
            description:
              typeof body.description === "string" ? body.description : null,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            ownerId: id,
            uploadedBy: c.get("user")!.id,
          });

        try {
          await ctx.dealAttachmentIngestionWorkflow.enqueueIfEligible({
            dealId: id,
            fileAssetId: attachment.id,
          });
        } catch (error) {
          ctx.logger.warn("Failed to enqueue deal attachment ingestion", {
            attachmentId: attachment.id,
            dealId: id,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        await ctx.dealsModule.deals.commands.appendTimelineEvent({
          actorUserId: c.get("user")!.id,
          dealId: id,
          payload: {
            attachmentId: attachment.id,
            fileName: attachment.fileName,
          },
          sourceRef: `attachment:${attachment.id}:uploaded`,
          type: "attachment_uploaded",
          visibility:
            attachment.visibility === "customer_safe"
              ? "customer_safe"
              : "internal",
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
        const attachments =
          await ctx.filesModule.files.queries.listDealAttachments(id);
        const attachment =
          attachments.find((item) => item.id === attachmentId) ?? null;
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
          visibility:
            attachment?.visibility === "customer_safe"
              ? "customer_safe"
              : "internal",
        });

        return jsonOk(c, { deleted: true });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(reingestAttachmentRoute, async (c) => {
      try {
        const { attachmentId, id } = c.req.valid("param");
        await requireDeal(ctx, id);
        const result = await ctx.dealAttachmentIngestionWorkflow.reingest({
          dealId: id,
          fileAssetId: attachmentId,
        });
        return jsonOk(c, result);
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

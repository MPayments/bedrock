import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  CalculationDetailsSchema,
  CreateCalculationInputSchema,
} from "@bedrock/calculations/contracts";
import {
  AmendDealLegBodyInputSchema,
  AssignDealAgentInputSchema,
  AttachDealPricingRouteRequestSchema,
  CloseDealInputSchema,
  CommitDealPricingInputSchema,
  CreateDealPricingQuoteInputSchema,
  CreateDealLegOperationInputSchema,
  CreateDealDraftInputSchema,
  DealAttachmentIngestionSchema,
  DealCalculationHistoryItemSchema,
  DealDetailsSchema,
  DealQuoteAcceptanceHistoryItemSchema,
  DealPricingCommitResultSchema,
  DealPricingContextSchema,
  DealPricingPreviewSchema,
  DealPricingQuoteResultSchema,
  DealPricingRouteListSchema,
  DealWorkflowProjectionSchema,
  RequestDealExecutionInputSchema,
  DealTraceSchema,
  PreviewDealPricingInputSchema,
  ReplaceDealIntakeInputSchema,
  ResolveDealExecutionBlockerInputSchema,
  SetDealLegManualOverrideInputSchema,
  SwapDealRouteTemplateInputSchema,
  TransitionDealStatusInputSchema,
  UpdateDealAgreementInputSchema,
  UpdateDealCommentInputSchema,
  UpdateDealPricingContextInputSchema,
} from "@bedrock/deals/contracts";
import {
  FileAttachmentPurposeSchema,
  FileAttachmentSchema,
  FileAttachmentVisibilitySchema,
} from "@bedrock/files/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";
import {
  QuoteListItemSchema,
  QuotePreviewResponseSchema,
  QuoteSchema,
  PreviewQuoteInputSchema,
} from "@bedrock/treasury/contracts";
import { assertDealAllowsCommercialWrite } from "@bedrock/workflow-deal-commercial";
import {
  CrmDealBoardProjectionSchema,
  CrmDealWorkbenchProjectionSchema,
  CrmDealsByDayItemSchema,
  CrmDealsByDayQuerySchema,
  CrmDealsByStatusSchema,
  CrmDealsListProjectionSchema,
  CrmDealsListQuerySchema,
  CrmDealsStatsQuerySchema,
  CrmDealsStatsSchema,
  FinanceDealQueueFiltersSchema,
  FinanceDealQueueProjectionSchema,
  FinanceDealReconciliationExceptionSchema,
  FinanceDealWorkspaceProjectionSchema,
} from "@bedrock/workflow-deal-projections/contracts";
import { PrintFormDescriptorSchema } from "@bedrock/workflow-document-generation";

import { DeletedSchema, ErrorSchema, IdParamSchema } from "../common";
import { handleRouteError } from "../common/errors";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import {
  getRequestContext,
  withRequiredIdempotency,
} from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";
import {
  DealScopedCreateDocumentInputSchema,
  requireDeal,
} from "./internal/deal-linked-resources";
import { toDocumentDto } from "./internal/document-dto";
import {
  PrintFormFormatQuerySchema,
  writeGeneratedDocumentResponse,
} from "./internal/print-forms";
import {
  serializeQuote,
  serializeQuoteListItem,
  serializeQuotePreview,
} from "./internal/treasury-quote-dto";

function serializeDealPricingPreview(
  preview: Awaited<ReturnType<AppContext["dealPricingWorkflow"]["preview"]>>,
) {
  return {
    benchmarks: preview.benchmarks,
    formulaTrace: preview.formulaTrace,
    fundingSummary: preview.fundingSummary,
    pricingFingerprint: preview.pricingFingerprint,
    pricingMode: preview.pricingMode,
    profitability: preview.profitability,
    quotePreview: serializeQuotePreview(preview.quotePreview),
    routePreview: preview.routePreview,
  };
}

function serializeDealPricingQuoteResult(
  result: Awaited<ReturnType<AppContext["dealPricingWorkflow"]["createQuote"]>>,
) {
  return {
    benchmarks: result.benchmarks,
    formulaTrace: result.formulaTrace,
    pricingMode: result.pricingMode,
    profitability: result.profitability,
    quote: {
      ...serializeQuote(result.quote),
      benchmarks: result.benchmarks,
      formulaTrace: result.formulaTrace,
      profitability: result.profitability,
    },
  };
}

export function dealsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const RECONCILIATION_DEFAULT_RULESET_CHECKSUM = "core-default-v1";
  const TREASURY_INSTRUCTION_OUTCOMES_RECONCILIATION_SOURCE =
    "treasury_instruction_outcomes";
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
  const DealExecutionLegParamsSchema = IdParamSchema.extend({
    legId: z
      .string()
      .uuid()
      .openapi({
        param: {
          in: "path",
          name: "legId",
        },
      }),
  });
  const DealReconciliationExceptionParamsSchema = IdParamSchema.extend({
    exceptionId: z
      .string()
      .uuid()
      .openapi({
        param: {
          in: "path",
          name: "exceptionId",
        },
      }),
  });
  const ResolveAdjustmentDocumentInputSchema = z
    .object({
      docType: z.string().trim().min(1),
      documentId: z.string().uuid(),
    })
    .strict();
  const DealCalculationHistorySchema = z.array(
    DealCalculationHistoryItemSchema,
  );
  const DealCalculationFromQuoteInputSchema = z
    .object({
      quoteId: z.string().uuid(),
    })
    .strict();
  const DealHistoricalCalculationImportInputSchema =
    CreateCalculationInputSchema.extend({
      sourceQuoteId: z.uuid().nullable().optional(),
    });
  const DealCreateQuoteInputSchema = PreviewQuoteInputSchema.and(
    z.object({
      fixedFeeAmount: z.string().trim().min(1).nullable().optional(),
      fixedFeeCurrency: z.string().trim().min(1).max(16).nullable().optional(),
      quoteMarkupBps: z.number().int().nonnegative().nullable().optional(),
    }),
  );
  const DealAttachmentVisibilityInputSchema = z.object({
    visibility: FileAttachmentVisibilitySchema.optional(),
  });
  const DealAttachmentPurposeInputSchema = z.object({
    purpose: FileAttachmentPurposeSchema,
  });
  const DealAttachmentRecognitionInputSchema = z.object({
    useRecognition: z
      .enum(["false", "true"])
      .optional()
      .transform((value) => value !== "false"),
  });

  async function getFinanceWorkspaceOrThrow(dealId: string) {
    await requireDeal(ctx, dealId);
    const workspace =
      await ctx.dealProjectionsWorkflow.getFinanceDealWorkspaceProjection(
        dealId,
      );

    if (!workspace) {
      throw new ValidationError(
        `Finance workspace is not available for deal ${dealId}`,
      );
    }

    return workspace;
  }

  async function getDealReconciliationException(input: {
    dealId: string;
    exceptionId: string;
  }) {
    const workspace = await getFinanceWorkspaceOrThrow(input.dealId);
    const exception = workspace.relatedResources.reconciliationExceptions.find(
      (item) => item.id === input.exceptionId,
    );

    if (!exception) {
      throw new ValidationError(
        `Reconciliation exception ${input.exceptionId} is not linked to deal ${input.dealId}`,
      );
    }

    return {
      exception,
      workspace,
    };
  }

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
            schema: CrmDealsListProjectionSchema,
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
      query: CrmDealsStatsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CrmDealsStatsSchema,
          },
        },
        description: "Deal statistics",
      },
    },
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
            schema: CrmDealsByStatusSchema,
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
      query: CrmDealsByDayQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(CrmDealsByDayItemSchema),
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

  const listDealReconciliationExceptionsRoute = createRoute({
    middleware: [
      requirePermission({ deals: ["list"], reconciliation: ["list"] }),
    ],
    method: "get",
    path: "/{id}/reconciliation/exceptions",
    tags: ["Deals"],
    summary: "List deal-scoped reconciliation exceptions",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(FinanceDealReconciliationExceptionSchema),
          },
        },
        description: "Reconciliation exceptions linked to the deal",
      },
    },
  });

  const runDealReconciliationRoute = createRoute({
    middleware: [
      requirePermission({ deals: ["update"], reconciliation: ["run"] }),
    ],
    method: "post",
    path: "/{id}/reconciliation/run",
    tags: ["Deals"],
    summary: "Run reconciliation for pending deal-linked records",
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
        description: "Updated finance deal workspace projection",
      },
    },
  });

  const ignoreDealReconciliationExceptionRoute = createRoute({
    middleware: [
      requirePermission({ deals: ["update"], reconciliation: ["ignore"] }),
    ],
    method: "post",
    path: "/{id}/reconciliation/exceptions/{exceptionId}/ignore",
    tags: ["Deals"],
    summary: "Ignore a deal-scoped reconciliation exception",
    request: {
      params: DealReconciliationExceptionParamsSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: FinanceDealWorkspaceProjectionSchema,
          },
        },
        description: "Updated finance deal workspace projection",
      },
    },
  });

  const resolveDealReconciliationAdjustmentRoute = createRoute({
    middleware: [
      requirePermission({
        deals: ["update"],
        documents: ["create"],
        reconciliation: ["resolve"],
      }),
    ],
    method: "post",
    path: "/{id}/reconciliation/exceptions/{exceptionId}/adjustment-document",
    tags: ["Deals"],
    summary:
      "Resolve a deal-scoped reconciliation exception with an adjustment document",
    request: {
      params: DealReconciliationExceptionParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: ResolveAdjustmentDocumentInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: FinanceDealWorkspaceProjectionSchema,
          },
        },
        description: "Updated finance deal workspace projection",
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

  const updateCommentRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "patch",
    path: "/{id}/comment",
    tags: ["Deals"],
    summary: "Update deal root comment",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateDealCommentInputSchema,
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

  const importHistoricalCalculationRoute = createRoute({
    middleware: [
      requirePermission({ calculations: ["create"], deals: ["update"] }),
    ],
    method: "post",
    path: "/{id}/calculations/import",
    tags: ["Deals"],
    summary: "Import a historical calculation and attach it to a deal",
    request: {
      params: IdParamSchema,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: DealHistoricalCalculationImportInputSchema,
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
        description: "Historical calculation imported and attached",
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
        description: "Deal or referenced entity not found",
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

  const requestExecutionRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/execution/request",
    tags: ["Deals"],
    summary: "Materialize deal execution legs into treasury operations",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: RequestDealExecutionInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealWorkflowProjectionSchema,
          },
        },
        description: "Execution requested",
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
        description: "Execution request blocked",
      },
    },
  });

  const createLegOperationRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/execution/legs/{legId}/operation",
    tags: ["Deals"],
    summary: "Create a missing treasury operation for an execution leg",
    request: {
      params: DealExecutionLegParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: CreateDealLegOperationInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealWorkflowProjectionSchema,
          },
        },
        description: "Execution leg operation created",
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
        description: "Deal or execution leg not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Execution leg operation creation blocked",
      },
    },
  });

  const resolveExecutionBlockerRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/execution/blockers/resolve",
    tags: ["Deals"],
    summary: "Resolve a supported execution blocker for a deal",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: ResolveDealExecutionBlockerInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealWorkflowProjectionSchema,
          },
        },
        description: "Execution blocker resolved",
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
        description: "Deal or blocker target not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Execution blocker cannot be resolved",
      },
    },
  });

  const closeDealRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/close",
    tags: ["Deals"],
    summary: "Close a fully executed deal",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CloseDealInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealWorkflowProjectionSchema,
          },
        },
        description: "Deal closed",
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
        description: "Deal not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Deal cannot be closed",
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

  const setLegManualOverrideRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/legs/{idx}/override",
    tags: ["Deals"],
    summary: "Set manual leg override (block / skip / clear)",
    request: {
      params: DealLegParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: SetDealLegManualOverrideInputSchema,
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
        description: "Leg manual override updated",
      },
    },
  });

  const amendLegRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/legs/{idx}/amend",
    tags: ["Deals"],
    summary: "Amend execution leg (counterparty/requisite/fees)",
    request: {
      params: DealLegParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: AmendDealLegBodyInputSchema,
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
        description: "Leg amended",
      },
      409: {
        content: {
          "application/json": { schema: ErrorSchema },
        },
        description: "Amendment conflicts with current state",
      },
    },
  });

  const swapRouteTemplateRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/pricing/route/swap",
    tags: ["Deals"],
    summary: "Swap the attached payment route template",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: SwapDealRouteTemplateInputSchema,
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
        description: "Route template swapped",
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
            schema: DealCreateQuoteInputSchema,
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

  const previewQuoteRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/quotes/preview",
    tags: ["Deals"],
    summary: "Preview a treasury quote for a deal",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: DealCreateQuoteInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: QuotePreviewResponseSchema,
          },
        },
        description: "Quote preview",
      },
    },
  });

  const listDealPricingRoutesRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/pricing/routes",
    tags: ["Deals"],
    summary: "List recommended payment routes for deal pricing",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealPricingRouteListSchema,
          },
        },
        description: "Recommended deal pricing routes",
      },
    },
  });

  const attachDealPricingRouteRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/pricing/route/attach",
    tags: ["Deals"],
    summary: "Attach a payment route template to a deal pricing context",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: AttachDealPricingRouteRequestSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealPricingContextSchema,
          },
        },
        description: "Updated deal pricing context",
      },
    },
  });

  const detachDealPricingRouteRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "delete",
    path: "/{id}/pricing/route",
    tags: ["Deals"],
    summary: "Detach the attached payment route from a deal pricing context",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealPricingContextSchema,
          },
        },
        description: "Updated deal pricing context",
      },
    },
  });

  const initializeDealPricingRouteRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/pricing/initialize-route",
    tags: ["Deals"],
    summary:
      "Auto-attach the default payment route to a deal pricing context (no-op if already attached)",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealPricingContextSchema,
          },
        },
        description:
          "Updated deal pricing context (route attached or unchanged when no candidates)",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Revision conflict",
      },
    },
  });

  const updateDealPricingContextRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "patch",
    path: "/{id}/pricing/context",
    tags: ["Deals"],
    summary: "Update deal pricing context economics and funding adjustments",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateDealPricingContextInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealPricingContextSchema,
          },
        },
        description: "Updated deal pricing context",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Revision conflict",
      },
    },
  });

  const previewDealPricingRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/pricing/preview",
    tags: ["Deals"],
    summary:
      "Preview deal pricing using an attached route or auto cross fallback",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: PreviewDealPricingInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealPricingPreviewSchema,
          },
        },
        description: "Deal pricing preview",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Revision conflict",
      },
    },
  });

  const createDealPricingQuoteRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/pricing/quotes",
    tags: ["Deals"],
    summary: "Create a treasury quote from the current deal pricing context",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CreateDealPricingQuoteInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: DealPricingQuoteResultSchema,
          },
        },
        description: "Created deal pricing quote",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Revision conflict",
      },
    },
  });

  const commitDealPricingRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/pricing/commit",
    tags: ["Deals"],
    summary:
      "Create, accept, and lock a deal pricing calculation in one request",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CommitDealPricingInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: DealPricingCommitResultSchema,
          },
        },
        description: "Deal pricing committed",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Revision conflict",
      },
    },
  });

  const listPrintFormsRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/print-forms",
    tags: ["Deals"],
    summary: "List deal print forms",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(PrintFormDescriptorSchema),
          },
        },
        description: "Deal print forms",
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

  const downloadPrintFormRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/print-forms/{formId}",
    tags: ["Deals"],
    summary: "Download a deal print form as DOCX/PDF",
    request: {
      params: IdParamSchema.extend({
        formId: z.string().min(1),
      }),
      query: PrintFormFormatQuerySchema,
    },
    responses: {
      200: { description: "Generated file" },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Deal or print form not found",
      },
    },
  });

  const listDealPricingAcceptancesRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/pricing/acceptances",
    tags: ["Deals"],
    summary: "List all quote acceptances for a deal (history chain)",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(DealQuoteAcceptanceHistoryItemSchema),
          },
        },
        description: "Acceptance history, newest first",
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
        const result = await ctx.dealProjectionsWorkflow.listCrmDeals(query);
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(statsRoute, async (c) => {
      try {
        const result = await ctx.dealProjectionsWorkflow.getCrmDealsStats(
          c.req.valid("query"),
        );
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(byStatusRoute, async (c) => {
      try {
        const result = await ctx.dealProjectionsWorkflow.listCrmDealsByStatus();
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(byDayRoute, async (c) => {
      try {
        const result = await ctx.dealProjectionsWorkflow.listCrmDealsByDay(
          c.req.valid("query"),
        );
        return jsonOk(c, result);
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
    .openapi(listDealReconciliationExceptionsRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const workspace = await getFinanceWorkspaceOrThrow(id);
        return jsonOk(c, workspace.relatedResources.reconciliationExceptions);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(runDealReconciliationRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        await getFinanceWorkspaceOrThrow(id);

        const result = await withRequiredIdempotency(
          c,
          async (idempotencyKey) => {
            const externalRecordIds =
              await ctx.reconciliationService.records.listPendingExternalRecordIds(
                {
                  normalizedPayloadTextFilter: {
                    key: "dealId",
                    value: id,
                  },
                  source: TREASURY_INSTRUCTION_OUTCOMES_RECONCILIATION_SOURCE,
                },
              );

            if (externalRecordIds.length > 0) {
              await ctx.reconciliationService.runs.runReconciliation({
                source: TREASURY_INSTRUCTION_OUTCOMES_RECONCILIATION_SOURCE,
                rulesetChecksum: RECONCILIATION_DEFAULT_RULESET_CHECKSUM,
                inputQuery: {
                  externalRecordIds,
                },
                actorUserId: c.get("user")!.id,
                idempotencyKey,
                requestContext: getRequestContext(c),
              });
            }

            const workspace = await getFinanceWorkspaceOrThrow(id);
            return workspace;
          },
        );

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(ignoreDealReconciliationExceptionRoute, async (c) => {
      try {
        const { exceptionId, id } = c.req.valid("param");
        await getDealReconciliationException({
          dealId: id,
          exceptionId,
        });

        await ctx.reconciliationService.exceptions.ignore(exceptionId);

        const workspace = await getFinanceWorkspaceOrThrow(id);
        return jsonOk(c, workspace);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(resolveDealReconciliationAdjustmentRoute, async (c) => {
      try {
        const { exceptionId, id } = c.req.valid("param");
        const body = c.req.valid("json");
        await getDealReconciliationException({
          dealId: id,
          exceptionId,
        });

        const document = await ctx.documentsService.get(
          body.docType,
          body.documentId,
          c.get("user")!.id,
        );

        if (document.dealId !== id) {
          throw new ValidationError(
            `Document ${body.documentId} is not linked to deal ${id}`,
          );
        }

        await ctx.reconciliationService.exceptions.resolveWithAdjustment({
          exceptionId,
          adjustmentDocumentId: body.documentId,
        });

        const workspace = await getFinanceWorkspaceOrThrow(id);
        return jsonOk(c, workspace);
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
    .openapi(updateCommentRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await ctx.dealsModule.deals.commands.updateComment({
          ...body,
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
        const actorUserId = c.get("user")!.id;
        const result = await ctx.dealPricingCommitWorkflow.acceptQuote({
          actorUserId,
          dealId: id,
          quoteId,
          requestContext: getRequestContext(c),
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
    .openapi(importHistoricalCalculationRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(
          c,
          async (idempotencyKey) => {
            await requireDeal(ctx, id);

            const { sourceQuoteId, ...calculationBody } = body;
            const calculation =
              await ctx.calculationsModule.calculations.commands.create({
                ...calculationBody,
                actorUserId: c.get("user")!.id,
                idempotencyKey,
              });

            await ctx.dealsModule.deals.commands.linkCalculation({
              actorUserId: c.get("user")!.id,
              calculationId: calculation.id,
              dealId: id,
              sourceQuoteId: sourceQuoteId ?? null,
            });

            return calculation;
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
    .openapi(requestExecutionRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(
          c,
          async (idempotencyKey) => {
            const deal = await requireDeal(ctx, id);
            assertDealAllowsCommercialWrite(deal);

            return ctx.dealExecutionWorkflow.requestExecution({
              actorUserId: c.get("user")!.id,
              comment: body.comment ?? null,
              dealId: id,
              idempotencyKey,
            });
          },
        );

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createLegOperationRoute, async (c) => {
      try {
        const { id, legId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(
          c,
          async (idempotencyKey) => {
            const deal = await requireDeal(ctx, id);
            assertDealAllowsCommercialWrite(deal);

            return ctx.dealExecutionWorkflow.createLegOperation({
              actorUserId: c.get("user")!.id,
              comment: body.comment ?? null,
              dealId: id,
              idempotencyKey,
              legId,
            });
          },
        );

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(resolveExecutionBlockerRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(
          c,
          async (idempotencyKey) => {
            const deal = await requireDeal(ctx, id);
            assertDealAllowsCommercialWrite(deal);

            return ctx.dealExecutionWorkflow.resolveExecutionBlocker({
              actorUserId: c.get("user")!.id,
              comment: body.comment ?? null,
              dealId: id,
              idempotencyKey,
              legId: body.legId,
            });
          },
        );

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(closeDealRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(
          c,
          async (idempotencyKey) => {
            const deal = await requireDeal(ctx, id);
            assertDealAllowsCommercialWrite(deal);

            return ctx.dealExecutionWorkflow.closeDeal({
              actorUserId: c.get("user")!.id,
              comment: body.comment ?? null,
              dealId: id,
              idempotencyKey,
            });
          },
        );

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(transitionStatusRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");

        if (body.status === "done") {
          const result = await withRequiredIdempotency(
            c,
            async (idempotencyKey) => {
              const deal = await requireDeal(ctx, id);
              assertDealAllowsCommercialWrite(deal);

              return ctx.dealExecutionWorkflow.closeDeal({
                actorUserId: c.get("user")!.id,
                comment: body.comment ?? null,
                dealId: id,
                idempotencyKey,
              });
            },
          );

          if (result instanceof Response) {
            return result;
          }

          return jsonOk(c, result);
        }

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
    .openapi(setLegManualOverrideRoute, async (c) => {
      try {
        const { id, idx } = c.req.valid("param");
        const body = c.req.valid("json");
        const result =
          await ctx.dealsModule.deals.commands.setLegManualOverride({
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
    .openapi(amendLegRoute, async (c) => {
      try {
        const { id, idx } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await ctx.dealsModule.deals.commands.amendDealLeg({
          ...body,
          actorUserId: c.get("user")!.id,
          dealId: id,
          legIdx: idx,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(swapRouteTemplateRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await ctx.dealPricingWorkflow.swapRouteTemplate({
          actorUserId: c.get("user")!.id,
          dealId: id,
          memo: body.memo ?? null,
          newRouteTemplateId: body.newRouteTemplateId,
          reasonCode: body.reasonCode,
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
          ctx.dealCommercialWorkflow.createQuote({
            dealId: id,
            idempotencyKey,
            quoteInput: body,
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
    .openapi(previewQuoteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await ctx.dealCommercialWorkflow.previewQuote({
          dealId: id,
          quoteInput: body,
        });

        return jsonOk(c, serializeQuotePreview(result));
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listDealPricingRoutesRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await ctx.dealPricingWorkflow.listRoutes({
          dealId: id,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(attachDealPricingRouteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await ctx.dealPricingWorkflow.attachRoute({
          dealId: id,
          routeTemplateId: body.routeTemplateId,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(detachDealPricingRouteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await ctx.dealPricingWorkflow.detachRoute({
          dealId: id,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(initializeDealPricingRouteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await ctx.dealPricingWorkflow.initializeDefaultRoute({
          dealId: id,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(updateDealPricingContextRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await ctx.dealPricingWorkflow.updateContext({
          dealId: id,
          patch: body,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(previewDealPricingRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await ctx.dealPricingWorkflow.preview({
          ...body,
          dealId: id,
        });

        return jsonOk(c, serializeDealPricingPreview(result));
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createDealPricingQuoteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.dealPricingWorkflow.createQuote({
            ...body,
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
            expiresAt: result.quote.expiresAt,
            pricingMode: result.pricingMode,
            quoteId: result.quote.id,
          },
          sourceRef: `quote:${result.quote.id}:created`,
          type: "quote_created",
          visibility: "internal",
        });

        return jsonOk(c, serializeDealPricingQuoteResult(result), 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(commitDealPricingRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const actorUserId = c.get("user")!.id;

        const result = await withRequiredIdempotency(
          c,
          async (idempotencyKey) => {
            return ctx.dealPricingCommitWorkflow.commitRoutePricing({
              actorUserId,
              dealId: id,
              idempotencyKey,
              pricing: body,
              requestContext: getRequestContext(c),
            });
          },
        );

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(
          c,
          {
            ...serializeDealPricingQuoteResult(result.quoteResult),
            calculationId: result.calculationId,
          },
          201,
        );
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listPrintFormsRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await ctx.documentGenerationWorkflow.listDealPrintForms({
          dealId: id,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(downloadPrintFormRoute, async (c): Promise<any> => {
      try {
        const { formId, id } = c.req.valid("param");
        const { format } = c.req.valid("query");
        const result =
          await ctx.documentGenerationWorkflow.generateDealPrintForm({
            dealId: id,
            formId,
            format,
          });

        return writeGeneratedDocumentResponse(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listDealPricingAcceptancesRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        await requireDeal(ctx, id);
        const acceptances =
          await ctx.dealsModule.deals.queries.listQuoteAcceptances(id);
        return jsonOk(c, acceptances);
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

        const rows = await Promise.all(
          result.data.map(async (document) => ({
            ...toDocumentDto(document),
            printForms:
              await ctx.documentGenerationWorkflow.listDocumentPrintForms({
                actorUserId: c.get("user")!.id,
                docType: document.document.docType,
                documentId: document.document.id,
              }),
          })),
        );

        return jsonOk(c, rows);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createFormalDocumentRoute, async (c) => {
      try {
        const { docType, id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.dealCommercialWorkflow.createFormalDocument({
            actorUserId: c.get("user")!.id,
            dealId: id,
            docType,
            idempotencyKey,
            payload: body.input,
            requestContext: getRequestContext(c),
            routeBodyDealId: body.dealId ?? null,
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
            documentId: result.document.id,
          },
          sourceRef: `document:${result.document.id}:created`,
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
        const attachmentRecognitionResult =
          DealAttachmentRecognitionInputSchema.safeParse({
            useRecognition:
              typeof body.useRecognition === "string"
                ? body.useRecognition
                : undefined,
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
        if (!attachmentRecognitionResult.success) {
          return c.json(
            { error: "useRecognition must be true or false" },
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

        if (attachmentRecognitionResult.data.useRecognition) {
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
        const trace = await ctx.dealCommercialWorkflow.buildTrace({
          dealId: id,
        });
        return jsonOk(c, trace);
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}

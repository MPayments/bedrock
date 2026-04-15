import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";

import { buildRouteEstimateCalculationInput } from "@bedrock/calculations";
import {
  CalculationCompareSchema,
  CalculationDetailsSchema,
  CalculationRateSourceSchema,
  CreateCalculationInputSchema,
} from "@bedrock/calculations/contracts";
import {
  AssignDealAgentInputSchema,
  ApplyDealRouteTemplateInputSchema,
  CloseDealInputSchema,
  CreateDealLegOperationInputSchema,
  CreateDealDraftInputSchema,
  CreateDealRouteDraftInputSchema,
  DealAttachmentIngestionSchema,
  DealCalculationHistoryItemSchema,
  DealDetailsSchema,
  DealRouteVersionSchema,
  DealWorkflowProjectionSchema,
  RequestDealExecutionInputSchema,
  DealTraceSchema,
  ReplaceDealRouteVersionInputSchema,
  ReplaceDealIntakeInputSchema,
  ResolveDealExecutionBlockerInputSchema,
  TransitionDealStatusInputSchema,
  UpdateDealAgreementInputSchema,
  UpdateDealCommentInputSchema,
  UpdateDealLegStateInputSchema,
} from "@bedrock/deals/contracts";
import {
  FileAttachmentPurposeSchema,
  FileAttachmentSchema,
  FileAttachmentVisibilitySchema,
} from "@bedrock/files/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";
import { mulDivRoundHalfUp, parseDecimalToFraction } from "@bedrock/shared/money";
import {
  PreviewQuoteInputSchema,
  QuotePreviewResponseSchema,
  QuoteListItemSchema,
  QuoteSchema,
} from "@bedrock/treasury/contracts";
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
  GeneratedDocumentFormatSchema,
  GeneratedDocumentLangSchema,
} from "./customer-files";
import {
  buildDealTrace,
  createDealScopedFormalDocument,
  createDealScopedQuote,
  previewDealScopedQuote,
  DealScopedCreateDocumentInputSchema,
  assertDealAllowsCommercialWrite,
  requireDeal,
} from "./internal/deal-linked-resources";
import { serializeCalculationDocumentData } from "./internal/calculation-document";
import { toDocumentDto } from "./internal/document-dto";
import {
  serializeQuoteDetails,
  serializeQuote,
  serializeQuoteListItem,
  serializeQuotePreview,
} from "./internal/treasury-quote-dto";

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
  const DealCalculationParamsSchema = IdParamSchema.extend({
    calculationId: z
      .string()
      .uuid()
      .openapi({
        param: {
          in: "path",
          name: "calculationId",
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
  const NullableDealRouteVersionSchema = DealRouteVersionSchema.nullable();
  const PositiveIntegerStringSchema = z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/u);
  const NonNegativeIntegerStringSchema = z
    .string()
    .trim()
    .regex(/^(0|[1-9]\d*)$/u);
  const DealCalculationFromQuoteInputSchema = z
    .object({
      quoteId: z.string().uuid(),
    })
    .strict();
  const DealCalculationFromRouteInputSchema = z
    .object({
      calculationTimestamp: z.coerce.date().optional(),
      quoteId: z.uuid().nullable().optional(),
      rateDen: PositiveIntegerStringSchema.nullable().optional(),
      rateNum: PositiveIntegerStringSchema.nullable().optional(),
      rateSource: CalculationRateSourceSchema.optional(),
      totalInBaseMinor: NonNegativeIntegerStringSchema.nullable().optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (
        value.quoteId &&
        (value.rateNum != null ||
          value.rateDen != null ||
          value.rateSource != null ||
          value.totalInBaseMinor != null)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["quoteId"],
          message:
            "quoteId cannot be combined with manual rate or totalInBaseMinor fields",
        });
      }

      if ((value.rateNum == null) !== (value.rateDen == null)) {
        ctx.addIssue({
          code: "custom",
          path: ["rateNum"],
          message: "rateNum and rateDen must be provided together",
        });
      }
    });
  const DealCalculationCompareQuerySchema = z
    .object({
      leftCalculationId: z.uuid().optional(),
      rightCalculationId: z.uuid().optional(),
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
      quoteMarkupPercent: z.string().trim().min(1).nullable().optional(),
    }),
  );
  const DealAttachmentVisibilityInputSchema = z.object({
    visibility: FileAttachmentVisibilitySchema.optional(),
  });
  const DealAttachmentPurposeInputSchema = z.object({
    purpose: FileAttachmentPurposeSchema,
  });

  async function getFinanceWorkspaceOrThrow(dealId: string) {
    await requireDeal(ctx, dealId);
    const workspace =
      await ctx.dealProjectionsWorkflow.getFinanceDealWorkspaceProjection(dealId);

    if (!workspace) {
      throw new ValidationError(`Finance workspace is not available for deal ${dealId}`);
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

  async function resolveSourceAmountMinorFromWorkflow(input: {
    workflow: Awaited<
      ReturnType<AppContext["dealsModule"]["deals"]["queries"]["findWorkflowById"]>
    >;
  }) {
    const sourceCurrencyId = input.workflow.intake.moneyRequest.sourceCurrencyId;
    const sourceAmount = input.workflow.intake.moneyRequest.sourceAmount;

    if (!sourceCurrencyId || !sourceAmount) {
      throw new ValidationError(
        `Deal ${input.workflow.summary.id} is missing source amount or source currency for route estimate`,
      );
    }

    const currency = await ctx.currenciesService.findById(sourceCurrencyId);
    const fraction = parseDecimalToFraction(sourceAmount, {
      allowScientific: false,
    });
    const scale = 10n ** BigInt(currency.precision);

    return {
      sourceAmountMinor: mulDivRoundHalfUp(fraction.num, scale, fraction.den),
      sourceCurrencyId,
    };
  }

  async function resolveRouteEstimateComparePair(input: { dealId: string }) {
    const [deal, history] = await Promise.all([
      requireDeal(ctx, input.dealId),
      ctx.dealsModule.deals.queries.listCalculationHistory(input.dealId),
    ]);
    const leftCalculationId = deal.calculationId ?? history[0]?.calculationId ?? null;
    const rightCalculationId =
      history.find((item) => item.calculationId !== leftCalculationId)
        ?.calculationId ?? null;

    if (!leftCalculationId || !rightCalculationId) {
      throw new ValidationError(
        `Deal ${input.dealId} does not have enough calculations to compare`,
      );
    }

    return {
      deal,
      history,
      leftCalculationId,
      rightCalculationId,
    };
  }

  async function requireDealLinkedCalculation(input: {
    calculationId: string;
    dealId: string;
  }) {
    const [deal, history] = await Promise.all([
      requireDeal(ctx, input.dealId),
      ctx.dealsModule.deals.queries.listCalculationHistory(input.dealId),
    ]);
    const allowedCalculationIds = new Set<string>(
      history.map((item) => item.calculationId),
    );

    if (deal.calculationId) {
      allowedCalculationIds.add(deal.calculationId);
    }

    if (!allowedCalculationIds.has(input.calculationId)) {
      throw new ValidationError(
        `Calculation ${input.calculationId} is not linked to deal ${input.dealId}`,
      );
    }

    return ctx.calculationsModule.calculations.queries.findById(
      input.calculationId,
    );
  }

  async function listPendingDealReconciliationExternalRecordIds(dealId: string) {
    const result = await ctx.persistence.db.execute(sql`
      select er.id::text as id
      from "reconciliation_external_records" er
      where er.source = ${TREASURY_INSTRUCTION_OUTCOMES_RECONCILIATION_SOURCE}
        and (er.normalized_payload ->> 'dealId') = ${dealId}
        and not exists (
          select 1
          from "reconciliation_matches" rm
          where rm.external_record_id = er.id
        )
      order by er.received_at asc, er.id asc
    `);

    return ((result.rows ?? []) as { id: string }[]).map((row) => row.id);
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

  const getCurrentRouteRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/route",
    tags: ["Deals"],
    summary: "Get current deal route version",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: NullableDealRouteVersionSchema,
          },
        },
        description: "Current deal route version or null when not drafted yet",
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
    summary: "Resolve a deal-scoped reconciliation exception with an adjustment document",
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

  const createRouteDraftRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/route/draft",
    tags: ["Deals"],
    summary: "Create an empty deal route draft if it does not exist",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CreateDealRouteDraftInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealRouteVersionSchema,
          },
        },
        description: "Current deal route draft",
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

  const applyRouteTemplateRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/route/apply-template",
    tags: ["Deals"],
    summary: "Apply a published route template to a deal",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: ApplyDealRouteTemplateInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealRouteVersionSchema,
          },
        },
        description: "Current deal route version after template application",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Deal or template not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Template cannot be applied",
      },
    },
  });

  const replaceRouteVersionRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "put",
    path: "/{id}/route",
    tags: ["Deals"],
    summary: "Replace the current deal route version",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: ReplaceDealRouteVersionInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealRouteVersionSchema,
          },
        },
        description: "Current deal route version",
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
        description: "Route validation failed",
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

  const getDealCalculationRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"], calculations: ["list"] })],
    method: "get",
    path: "/{id}/calculations/{calculationId}",
    tags: ["Deals"],
    summary: "Get a calculation linked to a deal",
    request: {
      params: DealCalculationParamsSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CalculationDetailsSchema,
          },
        },
        description: "Calculation detail",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Calculation is not linked to the deal",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Deal or calculation not found",
      },
    },
  });

  const exportDealCalculationRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"], calculations: ["list"] })],
    method: "get",
    path: "/{id}/calculations/{calculationId}/export",
    tags: ["Deals"],
    summary: "Export a calculation linked to a deal",
    request: {
      params: DealCalculationParamsSchema,
      query: z.object({
        format: GeneratedDocumentFormatSchema,
        lang: GeneratedDocumentLangSchema,
      }),
    },
    responses: {
      200: {
        description: "Calculation document",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Calculation is not linked to the deal",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Deal or calculation not found",
      },
    },
  });

  const createCalculationFromRouteRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/calculations/from-route",
    tags: ["Deals"],
    summary: "Create a route-based calculation estimate and attach it to a deal",
    request: {
      params: IdParamSchema,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: DealCalculationFromRouteInputSchema,
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
        description: "Route-based calculation created and attached",
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

  const compareDealCalculationsRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"], calculations: ["list"] })],
    method: "get",
    path: "/{id}/calculations/compare",
    tags: ["Deals"],
    summary: "Compare two deal calculations or default to current vs previous",
    request: {
      params: IdParamSchema,
      query: DealCalculationCompareQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CalculationCompareSchema,
          },
        },
        description: "Calculation comparison",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Invalid comparison request",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Deal or calculation not found",
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
    .openapi(getCurrentRouteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result =
          await ctx.dealsModule.deals.queries.findCurrentRouteByDealId(id);
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
              await listPendingDealReconciliationExternalRecordIds(id);

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
    .openapi(createRouteDraftRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        c.req.valid("json");
        const deal = await requireDeal(ctx, id);
        assertDealAllowsCommercialWrite(deal);
        const result = await ctx.dealsModule.deals.commands.createRouteDraft({
          dealId: id,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(applyRouteTemplateRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const deal = await requireDeal(ctx, id);
        assertDealAllowsCommercialWrite(deal);
        const result = await ctx.dealsModule.deals.commands.applyRouteTemplate({
          dealId: id,
          templateId: body.templateId,
        });

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(replaceRouteVersionRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const deal = await requireDeal(ctx, id);
        assertDealAllowsCommercialWrite(deal);
        const result = await ctx.dealsModule.deals.commands.replaceRouteVersion({
          ...body,
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
    .openapi(createCalculationFromRouteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(
          c,
          async (idempotencyKey) => {
            const actorUserId = c.get("user")!.id;
            const deal = await requireDeal(ctx, id);
            assertDealAllowsCommercialWrite(deal);

            const workflow =
              await ctx.dealsModule.deals.queries.findWorkflowById(id);

            if (!workflow) {
              throw new ValidationError(
                `Deal workflow is not available for deal ${id}`,
              );
            }

            const route =
              await ctx.dealsModule.deals.queries.findCurrentRouteByDealId(id);

            if (!route) {
              throw new ValidationError(
                `Deal ${id} does not have a current route version`,
              );
            }

            const { sourceAmountMinor, sourceCurrencyId } =
              await resolveSourceAmountMinorFromWorkflow({
                workflow,
              });

            let agreementPolicy: Parameters<
              typeof buildRouteEstimateCalculationInput
            >[0]["agreementPolicy"] = null;

            if (workflow.summary.agreementId) {
              const resolved =
                await ctx.agreementsModule.agreements.queries.resolveRouteDefaults(
                  {
                    agreementId: workflow.summary.agreementId,
                    dealType: deal.type,
                    sourceCurrencyId,
                    targetCurrencyId:
                      workflow.intake.moneyRequest.targetCurrencyId ?? null,
                  },
                );

              agreementPolicy = {
                agreementVersionId: resolved.agreementVersionId,
                defaultMarkupBps: resolved.policy?.defaultMarkupBps ?? null,
                defaultSubAgentCommissionAmountMinor:
                  resolved.policy?.defaultSubAgentCommissionAmountMinor ?? null,
                defaultSubAgentCommissionBps:
                  resolved.policy?.defaultSubAgentCommissionBps ?? null,
                defaultSubAgentCommissionCurrencyId:
                  resolved.policy?.defaultSubAgentCommissionCurrencyId ?? null,
                defaultSubAgentCommissionUnit:
                  resolved.policy?.defaultSubAgentCommissionUnit ?? null,
                defaultWireFeeAmountMinor:
                  resolved.policy?.defaultWireFeeAmountMinor ?? null,
                defaultWireFeeCurrencyId:
                  resolved.policy?.defaultWireFeeCurrencyId ?? null,
              };
            }

            const lastLeg = [...route.legs]
              .sort((left, right) => left.idx - right.idx)
              .at(-1) ?? null;
            const now = body.calculationTimestamp ?? new Date();

            const pricing = body.quoteId
              ? await (async () => {
                  const quoteId = body.quoteId;

                  if (!quoteId) {
                    throw new ValidationError("quoteId is required");
                  }

                  const quoteDetails =
                    await ctx.treasuryModule.quotes.queries.getQuoteDetails({
                      quoteRef: quoteId,
                    });
                  const quote = quoteDetails.quote;

                  if (quote.dealId && quote.dealId !== id) {
                    throw new ValidationError(
                      `Quote ${quote.id} is linked to deal ${quote.dealId}, not ${id}`,
                    );
                  }

                  if (quote.fromCurrencyId !== sourceCurrencyId) {
                    throw new ValidationError(
                      `Quote ${quote.id} source currency does not match deal ${id}`,
                    );
                  }

                  if (lastLeg && lastLeg.toCurrencyId !== quote.toCurrencyId) {
                    throw new ValidationError(
                      `Quote ${quote.id} target currency does not match current route for deal ${id}`,
                    );
                  }

                  return {
                    baseCurrencyId: quote.toCurrencyId,
                    calculationTimestamp: now,
                    fxQuoteId: quote.id,
                    quoteSnapshot: serializeQuoteDetails(quoteDetails),
                    rateDen: quote.rateDen,
                    rateNum: quote.rateNum,
                    rateSource: "fx_quote" as const,
                    totalInBaseMinor: quote.toAmountMinor,
                  };
                })()
              : {
                  baseCurrencyId: lastLeg?.toCurrencyId ?? null,
                  calculationTimestamp: now,
                  fxQuoteId: null,
                  quoteSnapshot: null,
                  rateDen:
                    body.rateDen === undefined || body.rateDen === null
                      ? null
                      : BigInt(body.rateDen),
                  rateNum:
                    body.rateNum === undefined || body.rateNum === null
                      ? null
                      : BigInt(body.rateNum),
                  rateSource: body.rateSource ?? "manual",
                  totalInBaseMinor:
                    body.totalInBaseMinor === undefined ||
                    body.totalInBaseMinor === null
                      ? null
                      : BigInt(body.totalInBaseMinor),
                };

            const calculationInput = buildRouteEstimateCalculationInput({
              agreementPolicy,
              deal: {
                dealId: id,
                sourceAmountMinor,
                sourceCurrencyId,
              },
              dealSnapshot: deal,
              pricing,
              route: {
                costComponents: route.costComponents,
                legs: route.legs,
                routeSnapshot: route,
                routeVersionId: route.id,
              },
            });

            const calculation =
              await ctx.calculationsModule.calculations.commands.create({
                ...calculationInput,
                actorUserId,
                idempotencyKey,
              });

            await ctx.dealsModule.deals.commands.linkCalculation({
              actorUserId,
              calculationId: calculation.id,
              dealId: id,
              sourceQuoteId: body.quoteId ?? null,
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
    .openapi(compareDealCalculationsRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const query = c.req.valid("query");
        const deal = await requireDeal(ctx, id);
        const history =
          await ctx.dealsModule.deals.queries.listCalculationHistory(id);
        const allowedCalculationIds = new Set<string>(
          history.map((item) => item.calculationId),
        );

        if (deal.calculationId) {
          allowedCalculationIds.add(deal.calculationId);
        }

        const hasExplicitPair =
          query.leftCalculationId !== undefined ||
          query.rightCalculationId !== undefined;

        const selection = hasExplicitPair
          ? {
              leftCalculationId: query.leftCalculationId ?? null,
              rightCalculationId: query.rightCalculationId ?? null,
            }
          : await resolveRouteEstimateComparePair({ dealId: id });

        if (
          (selection.leftCalculationId === null) !==
          (selection.rightCalculationId === null)
        ) {
          throw new ValidationError(
            "leftCalculationId and rightCalculationId must be provided together",
          );
        }

        if (!selection.leftCalculationId || !selection.rightCalculationId) {
          throw new ValidationError(
            `Deal ${id} does not have enough calculations to compare`,
          );
        }

        if (!allowedCalculationIds.has(selection.leftCalculationId)) {
          throw new ValidationError(
            `Calculation ${selection.leftCalculationId} is not linked to deal ${id}`,
          );
        }

        if (!allowedCalculationIds.has(selection.rightCalculationId)) {
          throw new ValidationError(
            `Calculation ${selection.rightCalculationId} is not linked to deal ${id}`,
          );
        }

        const result = await ctx.calculationsModule.calculations.queries.compare({
          leftCalculationId: selection.leftCalculationId,
          rightCalculationId: selection.rightCalculationId,
        });

        return jsonOk(c, result);
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
    .openapi(getDealCalculationRoute, async (c) => {
      try {
        const { id, calculationId } = c.req.valid("param");
        const calculation = await requireDealLinkedCalculation({
          calculationId,
          dealId: id,
        });

        return jsonOk(c, calculation);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(exportDealCalculationRoute, async (c) => {
      try {
        const { id, calculationId } = c.req.valid("param");
        const { format, lang } = c.req.valid("query");
        const calculation = await requireDealLinkedCalculation({
          calculationId,
          dealId: id,
        });
        const calculationData = await serializeCalculationDocumentData({
          calculation,
          currenciesService: ctx.currenciesService,
        });
        const result = await ctx.documentGenerationWorkflow.generateCalculation({
          calculationData,
          format,
          lang,
        });

        c.header("Content-Type", result.mimeType);
        c.header(
          "Content-Disposition",
          `attachment; filename="${result.fileName}"`,
        );
        return c.body(result.buffer as unknown as ArrayBuffer);
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
    .openapi(previewQuoteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await previewDealScopedQuote({
          body,
          ctx,
          dealId: id,
        });

        return jsonOk(c, serializeQuotePreview(result));
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

import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";

import {
  TreasuryInstructionActionsSchema,
  TreasuryInstructionAvailableOutcomeTransitionsSchema,
  TreasuryInstructionSchema,
  TreasuryOperationInstructionStatusSchema,
  TreasuryOperationKindSchema,
  TreasuryOperationProjectedStateSchema,
  TreasuryOperationStateSchema,
} from "@bedrock/treasury/contracts";
import {
  FinanceDealPaymentStepSchema,
  type FinanceDealPaymentStep as FinanceDealPaymentStepFromSchema,
  type FinanceDealPaymentStepAttempt as FinanceDealPaymentStepAttemptFromSchema,
} from "@/features/treasury/steps/lib/schemas";
import {
  paginateInMemory,
  sortInMemory,
  type SortInput,
} from "@bedrock/shared/core/pagination";

import type { EntityListResult } from "@bedrock/sdk-tables-ui/components/entity-table-shell";
import { deriveFinanceDealBlockerState } from "@/features/treasury/deals/lib/execution-summary";
import { readJsonWithSchema, requestOk } from "@/lib/api/response";
import {
  FINANCE_DEAL_BLOCKER_STATE_VALUES,
  FINANCE_DEAL_QUEUE_VALUES,
  FINANCE_DEAL_STAGE_VALUES,
  FINANCE_DEAL_STATUS_VALUES,
  FINANCE_DEAL_TYPE_VALUES,
  type FinanceDealBlockerState,
  getFinanceDealQueueLabel,
  getFinanceDealStatusLabel,
  getFinanceDealTypeLabel,
  type FinanceDealQueue,
  type FinanceDealStage,
  type FinanceDealStatus,
  type FinanceDealType,
} from "../labels";

import type { FinanceDealsSearchParams, FinanceDealsSortId } from "./validations";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3000";

const FinanceDealBlockerStateSchema = z.enum(FINANCE_DEAL_BLOCKER_STATE_VALUES);
const FinanceDealQueueSchema = z.enum(FINANCE_DEAL_QUEUE_VALUES);
const FinanceDealStageSchema = z.enum(FINANCE_DEAL_STAGE_VALUES);
const FinanceDealStatusSchema = z.enum(FINANCE_DEAL_STATUS_VALUES);
const FinanceDealTypeSchema = z.enum(FINANCE_DEAL_TYPE_VALUES);
const DealIdSchema = z.uuid({ version: "v4" });
const FileAttachmentVisibilitySchema = z.enum(["customer_safe", "internal"]);
const ISO_DATE_TIME_WITHOUT_TIMEZONE_PATTERN =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/;
const ISO_DATE_TIME_WITH_TIMEZONE_PATTERN =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})$/;

function normalizeApiDateTimeString(value: string) {
  const normalized = value.trim();

  if (z.iso.datetime().safeParse(normalized).success) {
    return normalized;
  }

  const withoutTimezoneMatch =
    ISO_DATE_TIME_WITHOUT_TIMEZONE_PATTERN.exec(normalized);

  if (withoutTimezoneMatch?.[1] && withoutTimezoneMatch[2]) {
    return `${withoutTimezoneMatch[1]}T${withoutTimezoneMatch[2]}Z`;
  }

  const withTimezoneMatch =
    ISO_DATE_TIME_WITH_TIMEZONE_PATTERN.exec(normalized);

  if (withTimezoneMatch?.[1] && withTimezoneMatch[2] && withTimezoneMatch[3]) {
    const timestamp = Date.parse(
      `${withTimezoneMatch[1]}T${withTimezoneMatch[2]}${withTimezoneMatch[3]}`,
    );

    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  return normalized;
}

function parseApiDateTimeValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "number") {
    const normalizedDate = new Date(value);
    return Number.isNaN(normalizedDate.getTime())
      ? null
      : normalizedDate.toISOString();
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["$date", "date", "dateTime", "datetime", "value"]) {
      if (key in record) {
        return parseApiDateTimeValue(record[key]);
      }
    }

    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeApiDateTimeString(value);

  if (normalized.length === 0) {
    return null;
  }

  const isoCandidate = z.iso.datetime().safeParse(normalized);

  if (isoCandidate.success) {
    return isoCandidate.data;
  }

  const parsedTimestamp = Date.parse(normalized);

  if (!Number.isNaN(parsedTimestamp)) {
    return new Date(parsedTimestamp).toISOString();
  }

  return null;
}

const ApiDateTimeStringSchema = z.unknown().transform((value, context) => {
  const parsed = parseApiDateTimeValue(value);

  if (!parsed) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid datetime",
    });

    return z.NEVER;
  }

  return parsed;
});

const NullableApiDateTimeStringSchema = z
  .unknown()
  .transform((value) => parseApiDateTimeValue(value));

const FinanceDealQueueFiltersSchema = z.object({
  applicant: z.string().trim().min(1).optional(),
  internalEntity: z.string().trim().min(1).optional(),
  queue: FinanceDealQueueSchema.optional(),
  stage: FinanceDealStageSchema.optional(),
  status: FinanceDealStatusSchema.optional(),
  type: FinanceDealTypeSchema.optional(),
});
const FinanceProfitabilityAmountSchema = z.object({
  amountMinor: z.string(),
  currencyCode: z.string(),
  currencyId: z.string().uuid(),
});

const FinanceDealNetProfitSchema = z
  .object({
    commercialRevenueMinor: z.string(),
    costPriceMinor: z.string(),
    currency: z.string(),
    customerPrincipalMinor: z.string(),
    customerTotalMinor: z.string(),
    passThroughMinor: z.string(),
    profitMinor: z.string(),
    profitPercentOnCost: z.string(),
  })
  .nullable();

const FinanceDealCashflowSummarySchema = z.object({
  receivedIn: z.array(FinanceProfitabilityAmountSchema),
  scheduledOut: z.array(FinanceProfitabilityAmountSchema),
  settledOut: z.array(FinanceProfitabilityAmountSchema),
});

const FinanceDealListItemSchema = z.object({
  applicantName: z.string().nullable(),
  blockingReasons: z.array(z.string()),
  createdAt: z.iso.datetime(),
  dealId: z.string().uuid(),
  documentSummary: z.object({
    attachmentCount: z.number().int().nonnegative(),
    formalDocumentCount: z.number().int().nonnegative(),
  }),
  executionSummary: z.object({
    blockedLegCount: z.number().int().nonnegative(),
    doneLegCount: z.number().int().nonnegative(),
    totalLegCount: z.number().int().nonnegative(),
  }),
  internalEntityName: z.string().nullable(),
  nextAction: z.string(),
  profitabilitySnapshot: z
    .object({
      calculationId: z.string().uuid(),
      feeRevenue: z.array(FinanceProfitabilityAmountSchema),
      netProfit: FinanceDealNetProfitSchema,
      providerFeeExpense: z.array(FinanceProfitabilityAmountSchema),
      spreadRevenue: z.array(FinanceProfitabilityAmountSchema),
      totalRevenue: z.array(FinanceProfitabilityAmountSchema),
    })
    .nullable(),
  queue: FinanceDealQueueSchema,
  queueReason: z.string(),
  stage: FinanceDealStageSchema,
  stageReason: z.string(),
  quoteSummary: z
    .object({
      expiresAt: NullableApiDateTimeStringSchema,
      quoteId: z.string().uuid().nullable(),
      status: z.string().nullable(),
    })
    .nullable(),
  status: FinanceDealStatusSchema,
  type: FinanceDealTypeSchema,
});

const FinanceDealsResponseSchema = z.object({
  counts: z.object({
    execution: z.number().int().nonnegative(),
    failed_instruction: z.number().int().nonnegative(),
    funding: z.number().int().nonnegative(),
  }),
  filters: FinanceDealQueueFiltersSchema,
  items: z.array(FinanceDealListItemSchema),
});

const FinanceDealWorkspaceActionsSchema = z.object({
  canCloseDeal: z.boolean(),
  canCreateCalculation: z.boolean(),
  canCreateQuote: z.boolean(),
  canRequestExecution: z.boolean(),
  canRunReconciliation: z.boolean(),
  canResolveExecutionBlocker: z.boolean(),
  canUploadAttachment: z.boolean(),
});

const FinanceDealExecutionLegDocumentActionSchema = z.object({
  activeDocumentId: z.string().uuid().nullable(),
  createAllowed: z.boolean(),
  docType: z.string(),
  openAllowed: z.boolean(),
});

const FinanceDealAttachmentRequirementSchema = z.object({
  blockingReasons: z.array(z.string()),
  code: z.string(),
  label: z.string(),
  state: z.enum(["missing", "not_required", "provided"]),
});

const FinanceDealFormalDocumentRequirementSchema = z.object({
  activeDocumentId: z.string().uuid().nullable(),
  blockingReasons: z.array(z.string()),
  createAllowed: z.boolean(),
  docType: z.string(),
  openAllowed: z.boolean(),
  stage: z.enum(["opening", "closing"]),
  state: z.enum(["in_progress", "missing", "not_required", "ready"]),
});

const FinanceDealRouteAttachmentLegSchema = z.object({
  fees: z.array(
    z.object({
      chargeToCustomer: z.boolean(),
      kind: z.string(),
      label: z.string(),
      percentage: z.string().nullable(),
    }),
  ),
  fromAmountMinor: z.string().nullable().default(null),
  fromCurrencyCode: z.string().nullable(),
  fromCurrencyId: z.string().uuid(),
  id: z.string(),
  rateDen: z.string().nullable().default(null),
  rateNum: z.string().nullable().default(null),
  toAmountMinor: z.string().nullable().default(null),
  toCurrencyCode: z.string().nullable(),
  toCurrencyId: z.string().uuid(),
});

const FinanceDealRouteAttachmentParticipantSchema = z.object({
  binding: z.enum(["abstract", "bound"]),
  displayName: z.string(),
  entityId: z.string().uuid().nullable(),
  entityKind: z.enum(["customer", "organization", "counterparty"]).nullable(),
  nodeId: z.string(),
  requisiteId: z.string().uuid().nullable().default(null),
  role: z.enum(["source", "hop", "destination"]),
});

const FinanceDealRouteAttachmentSchema = z.object({
  attachedAt: z.iso.datetime(),
  legs: z.array(FinanceDealRouteAttachmentLegSchema),
  participants: z.array(FinanceDealRouteAttachmentParticipantSchema).default([]),
  templateId: z.string().uuid(),
  templateName: z.string(),
});

const FinanceDealPricingContextSchema = z.object({
  fundingMessage: z.string().nullable(),
  fundingResolution: z.object({
    availableMinor: z.string().nullable(),
    fundingOrganizationId: z.string().uuid().nullable(),
    fundingRequisiteId: z.string().uuid().nullable(),
    reasonCode: z.string().nullable(),
    requiredAmountMinor: z.string().nullable(),
    state: z.enum(["not_applicable", "blocked", "resolved"]),
    strategy: z.enum(["existing_inventory", "external_fx"]).nullable(),
    targetCurrency: z.string().nullable(),
    targetCurrencyId: z.string().uuid().nullable(),
  }),
  quoteAmount: z.string().nullable(),
  quoteAmountSide: z.enum(["source", "target"]),
  quoteEligibility: z.boolean(),
  routeAttachment: FinanceDealRouteAttachmentSchema.nullable(),
  sourceCurrencyId: z.string().uuid().nullable(),
  targetCurrencyId: z.string().uuid().nullable(),
});

const FinanceDealAttachmentSchema = z.object({
  createdAt: z.iso.datetime(),
  description: z.string().nullable(),
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
  id: z.string().uuid(),
  mimeType: z.string(),
  updatedAt: z.iso.datetime(),
  uploadedBy: z.string().nullable(),
  visibility: FileAttachmentVisibilitySchema.nullable(),
});

const FinanceDealFormalDocumentSchema = z.object({
  approvalStatus: z.string().nullable(),
  createdAt: z.iso.datetime().nullable(),
  docType: z.string(),
  id: z.string().uuid(),
  lifecycleStatus: z.string().nullable(),
  occurredAt: z.iso.datetime().nullable(),
  postingStatus: z.string().nullable(),
  submissionStatus: z.string().nullable(),
});

const FinanceDealWorkspaceQuoteSchema = z.object({
  expiresAt: NullableApiDateTimeStringSchema,
  id: z.string().uuid(),
  status: z.string(),
});

const FinanceDealQuoteItemSchema = z.object({
  createdAt: z.iso.datetime(),
  dealDirection: z.string().nullable(),
  dealForm: z.string().nullable(),
  dealId: z.string().uuid().nullable(),
  dealRef: z
    .object({
      applicantName: z.string().nullable(),
      dealId: z.string().uuid(),
      status: z.string(),
      type: FinanceDealTypeSchema,
    })
    .nullable()
    .optional(),
  expiresAt: ApiDateTimeStringSchema,
  fromAmount: z.string(),
  fromAmountMinor: z.string(),
  fromCurrency: z.string(),
  fromCurrencyId: z.string().uuid(),
  id: z.string().uuid(),
  idempotencyKey: z.string(),
  pricingMode: z.string(),
  pricingTrace: z.record(z.string(), z.unknown()),
  rateDen: z.string(),
  rateNum: z.string(),
  status: z.string(),
  toAmount: z.string(),
  toAmountMinor: z.string(),
  toCurrency: z.string(),
  toCurrencyId: z.string().uuid(),
  usedAt: z.iso.datetime().nullable(),
  usedByRef: z.string().nullable(),
  usedDocumentId: z.string().uuid().nullable(),
});

const FinanceDealWorkflowParticipantSchema = z.object({
  counterpartyId: z.string().uuid().nullable(),
  customerId: z.string().uuid().nullable(),
  displayName: z.string().nullable().default(null),
  organizationId: z.string().uuid().nullable(),
  role: z.enum([
    "applicant",
    "customer",
    "external_beneficiary",
    "external_payer",
    "internal_entity",
  ]),
});

const FinanceDealWorkflowContextSchema = z.object({
  fundingResolution: FinanceDealPricingContextSchema.shape.fundingResolution,
  intake: z.object({
    common: z.object({
      applicantCounterpartyId: z.string().uuid().nullable(),
    }),
  }),
  participants: z.array(FinanceDealWorkflowParticipantSchema),
  summary: z.object({
    agreementId: z.string().uuid(),
  }),
});

const FinanceDealCalculationHistoryItemSchema = z.object({
  baseCurrencyId: z.string().uuid(),
  calculationCurrencyId: z.string().uuid(),
  calculationId: z.string().uuid(),
  calculationTimestamp: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  totalFeeAmountMinor: z.string(),
  fxQuoteId: z.string().uuid().nullable(),
  originalAmountMinor: z.string(),
  rateDen: z.string(),
  rateNum: z.string(),
  sourceQuoteId: z.string().uuid().nullable(),
  totalAmountMinor: z.string(),
  totalInBaseMinor: z.string(),
  totalWithExpensesInBaseMinor: z.string(),
});

const FinanceDealSummarySchema = z.object({
  applicantDisplayName: z.string().nullable(),
  calculationId: z.string().uuid().nullable(),
  createdAt: z.iso.datetime(),
  id: z.string().uuid(),
  internalEntityDisplayName: z.string().nullable(),
  status: FinanceDealStatusSchema,
  type: FinanceDealTypeSchema,
  updatedAt: z.iso.datetime(),
});

const FinanceDealLegOperationRefSchema = z.object({
  kind: z.string(),
  operationId: z.string().uuid(),
  sourceRef: z.string(),
});

const FinanceDealOperationSchema = z.object({
  actions: TreasuryInstructionActionsSchema,
  availableOutcomeTransitions:
    TreasuryInstructionAvailableOutcomeTransitionsSchema,
  id: z.string().uuid(),
  instructionStatus: TreasuryOperationInstructionStatusSchema,
  kind: TreasuryOperationKindSchema,
  latestInstruction: TreasuryInstructionSchema.nullable(),
  operationHref: z.string(),
  projectedState: TreasuryOperationProjectedStateSchema.nullable(),
  sourceRef: z.string(),
  state: TreasuryOperationStateSchema,
});

const FinanceDealInstructionArtifactSchema = z.object({
  fileAssetId: z.string().uuid(),
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
  id: z.string().uuid(),
  instructionId: z.string().uuid(),
  legIdx: z.number().int().positive().nullable(),
  legKind: z.string().nullable(),
  memo: z.string().nullable(),
  mimeType: z.string(),
  operationId: z.string().uuid(),
  purpose: z.string(),
  uploadedAt: z.iso.datetime(),
  uploadedByUserId: z.string(),
});

const FinanceDealInstructionSummarySchema = z.object({
  failed: z.number().int().nonnegative(),
  planned: z.number().int().nonnegative(),
  prepared: z.number().int().nonnegative(),
  returnRequested: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  settled: z.number().int().nonnegative(),
  submitted: z.number().int().nonnegative(),
  terminalOperations: z.number().int().nonnegative(),
  totalOperations: z.number().int().nonnegative(),
  voided: z.number().int().nonnegative(),
});

const FinanceDealReconciliationExceptionSchema = z.object({
  actions: z.object({
    adjustmentDocumentDocType: z.string().nullable(),
    canIgnore: z.boolean(),
  }),
  blocking: z.boolean(),
  createdAt: ApiDateTimeStringSchema,
  externalRecordId: z.string(),
  id: z.string(),
  operationId: z.string(),
  reasonCode: z.string(),
  resolvedAt: NullableApiDateTimeStringSchema,
  source: z.string(),
  state: z.enum(["open", "resolved", "ignored"]),
});

const FinanceDealReconciliationSummarySchema = z.object({
  ignoredExceptionCount: z.number().int().nonnegative(),
  lastActivityAt: NullableApiDateTimeStringSchema,
  openExceptionCount: z.number().int().nonnegative(),
  pendingOperationCount: z.number().int().nonnegative(),
  reconciledOperationCount: z.number().int().nonnegative(),
  requiredOperationCount: z.number().int().nonnegative(),
  resolvedExceptionCount: z.number().int().nonnegative(),
  state: z.enum(["not_started", "pending", "clear", "blocked"]),
});

const FinanceDealCloseReadinessSchema = z.object({
  blockers: z.array(z.string()),
  criteria: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      satisfied: z.boolean(),
    }),
  ),
  ready: z.boolean(),
});

const FinanceDealWorkspaceSchema = z.object({
  acceptedQuote: z
    .object({
      acceptedAt: ApiDateTimeStringSchema,
      expiresAt: NullableApiDateTimeStringSchema,
      quoteId: z.string().uuid(),
      quoteStatus: z.string(),
      usedAt: NullableApiDateTimeStringSchema,
    })
    .nullable(),
  acceptedQuoteDetails: FinanceDealQuoteItemSchema.nullable(),
  actions: FinanceDealWorkspaceActionsSchema,
  attachmentRequirements: z.array(FinanceDealAttachmentRequirementSchema),
  cashflowSummary: FinanceDealCashflowSummarySchema.default({
    receivedIn: [],
    scheduledOut: [],
    settledOut: [],
  }),
  closeReadiness: FinanceDealCloseReadinessSchema,
  executionPlan: z.array(
    z.object({
      actions: z.object({
        canCreateLegOperation: z.boolean(),
        exchangeDocument: FinanceDealExecutionLegDocumentActionSchema.nullable(),
      }),
      fromCurrencyId: z.string().uuid().nullable().default(null),
      id: z.string().uuid().nullable(),
      idx: z.number().int().positive(),
      kind: z.string(),
      operationRefs: z.array(FinanceDealLegOperationRefSchema),
      routeSnapshotLegId: z.string().nullable().default(null),
      state: z.string(),
      toCurrencyId: z.string().uuid().nullable().default(null),
    }),
  ),
  formalDocumentRequirements: z.array(
    FinanceDealFormalDocumentRequirementSchema,
  ),
  instructionSummary: FinanceDealInstructionSummarySchema,
  nextAction: z.string(),
  operationalState: z.object({
    positions: z.array(
      z.object({
        amountMinor: z.string().nullable(),
        kind: z.string(),
        reasonCode: z.string().nullable(),
        state: z.string(),
      }),
    ),
  }),
  pricing: FinanceDealPricingContextSchema,
  profitabilitySnapshot: z
    .object({
      calculationId: z.string().uuid(),
      feeRevenue: z.array(FinanceProfitabilityAmountSchema),
      netProfit: FinanceDealNetProfitSchema,
      providerFeeExpense: z.array(FinanceProfitabilityAmountSchema),
      spreadRevenue: z.array(FinanceProfitabilityAmountSchema),
      totalRevenue: z.array(FinanceProfitabilityAmountSchema),
    })
    .nullable(),
  queueContext: z.object({
    blockers: z.array(z.string()),
    queue: FinanceDealQueueSchema,
    queueReason: z.string(),
  }),
  reconciliationSummary: FinanceDealReconciliationSummarySchema,
  relatedResources: z.object({
    attachments: z.array(FinanceDealAttachmentSchema),
    formalDocuments: z.array(FinanceDealFormalDocumentSchema),
    instructionArtifacts: z
      .array(FinanceDealInstructionArtifactSchema)
      .default([]),
    operations: z.array(FinanceDealOperationSchema),
    paymentSteps: z.array(FinanceDealPaymentStepSchema).default([]),
    quotes: z.array(FinanceDealWorkspaceQuoteSchema),
    reconciliationExceptions: z.array(FinanceDealReconciliationExceptionSchema),
  }),
  summary: FinanceDealSummarySchema,
  timeline: z.array(
    z.object({
      actor: z
        .object({
          label: z.string().nullable(),
        })
        .nullable(),
      id: z.string().uuid(),
      occurredAt: z.iso.datetime(),
      payload: z.record(z.string(), z.unknown()),
      type: z.string(),
    }),
  ),
  workflow: FinanceDealWorkflowContextSchema.optional(),
});

const FinanceDealBreadcrumbSchema = z.object({
  summary: FinanceDealSummarySchema,
});

type FinanceDealApiFilters = z.infer<typeof FinanceDealQueueFiltersSchema>;
type FinanceDealFilters = FinanceDealApiFilters & {
  blockerState?: FinanceDealBlockerState;
};

async function fetchApi(path: string) {
  const requestHeaders = await headers();

  return fetch(`${API_URL}${path}`, {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
      "x-bedrock-app-audience": "finance",
    },
    cache: "no-store",
  });
}

function getStringValue(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveSort(search: FinanceDealsSearchParams): {
  sortBy?: FinanceDealsSortId;
  sortOrder?: SortInput["sortOrder"];
} {
  const firstSort = search.sort?.[0];

  if (!firstSort) {
    return {
      sortBy: "createdAt",
      sortOrder: "desc",
    };
  }

  return {
    sortBy: firstSort.id as FinanceDealsSortId,
    sortOrder: firstSort.desc ? "desc" : "asc",
  };
}

function resolvePagination(search: FinanceDealsSearchParams) {
  const limit = typeof search.perPage === "number" ? search.perPage : 10;
  const page = typeof search.page === "number" ? search.page : 1;
  const offset = Math.max(0, (page - 1) * limit);

  return {
    limit,
    offset,
  };
}

function createFinanceDealFilters(
  search: FinanceDealsSearchParams,
): FinanceDealFilters {
  const blockerState = getStringValue(search.blockerState);
  const queue = getStringValue(search.queue);
  const stage = getStringValue(search.stage);
  const status = getStringValue(search.status);
  const type = getStringValue(search.type);

  return {
    applicant: getStringValue(search.applicant),
    blockerState: FinanceDealBlockerStateSchema.safeParse(blockerState).success
      ? (blockerState as FinanceDealBlockerState)
      : undefined,
    internalEntity: getStringValue(search.internalEntity),
    queue: FINANCE_DEAL_QUEUE_VALUES.includes(queue as FinanceDealQueue)
      ? (queue as FinanceDealQueue)
      : undefined,
    stage: FINANCE_DEAL_STAGE_VALUES.includes(stage as FinanceDealStage)
      ? (stage as FinanceDealStage)
      : undefined,
    status: FINANCE_DEAL_STATUS_VALUES.includes(status as FinanceDealStatus)
      ? (status as FinanceDealStatus)
      : undefined,
    type: FINANCE_DEAL_TYPE_VALUES.includes(type as FinanceDealType)
      ? (type as FinanceDealType)
      : undefined,
  };
}

function createFinanceDealsPath(filters: FinanceDealFilters) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (key !== "blockerState" && value) {
      query.set(key, value);
    }
  }

  return `/v1/deals/finance/queues?${query.toString()}`;
}

const FINANCE_DEAL_SORT_MAP: Record<
  FinanceDealsSortId,
  (item: FinanceDealListItem) => string
> = {
  applicantName: (item) => item.applicantName ?? "",
  createdAt: (item) => item.createdAt,
  internalEntityName: (item) => item.internalEntityName ?? "",
  queue: (item) => getFinanceDealQueueLabel(item.queue),
  status: (item) => getFinanceDealStatusLabel(item.status),
  type: (item) => getFinanceDealTypeLabel(item.type),
};

export type FinanceDealAttachmentRequirement = z.infer<
  typeof FinanceDealAttachmentRequirementSchema
>;
export type FinanceDealRouteAttachment = z.infer<
  typeof FinanceDealRouteAttachmentSchema
>;
export type FinanceDealRouteAttachmentLeg = z.infer<
  typeof FinanceDealRouteAttachmentLegSchema
>;
export type FinanceDealRouteAttachmentParticipant = z.infer<
  typeof FinanceDealRouteAttachmentParticipantSchema
>;
export type FinanceDealInstructionArtifact = z.infer<
  typeof FinanceDealInstructionArtifactSchema
>;
// Re-export the shared step schemas under the deal-workbench's own type
// names so existing callers (components, tests) don't have to chase the
// shared module themselves.
export type FinanceDealPaymentStep = FinanceDealPaymentStepFromSchema;
export type FinanceDealPaymentStepAttempt = FinanceDealPaymentStepAttemptFromSchema;
export type FinanceDealCalculationHistoryItem = z.infer<
  typeof FinanceDealCalculationHistoryItemSchema
>;
export type FinanceDealFormalDocumentRequirement = z.infer<
  typeof FinanceDealFormalDocumentRequirementSchema
>;
export type FinanceProfitabilityAmount = z.infer<
  typeof FinanceProfitabilityAmountSchema
>;
export type FinanceDealCashflowSummary = z.infer<
  typeof FinanceDealCashflowSummarySchema
>;
export type FinanceDealListItem = z.infer<typeof FinanceDealListItemSchema> & {
  blockerState: FinanceDealBlockerState;
};
export type FinanceDealQuoteItem = z.infer<typeof FinanceDealQuoteItemSchema>;
export type FinanceDealWorkflowContext = z.infer<
  typeof FinanceDealWorkflowContextSchema
>;
export type FinanceDealsListResult = EntityListResult<FinanceDealListItem>;
export type FinanceDealBreadcrumb = z.infer<typeof FinanceDealBreadcrumbSchema>;
export type FinanceDealWorkspace = z.infer<typeof FinanceDealWorkspaceSchema>;
export type FinanceDealWorkbench = FinanceDealWorkspace & {
  calculationHistory: FinanceDealCalculationHistoryItem[];
  /**
   * Payment steps that materialize the deal execution plan, ordered by
   * `dealLegIdx` ascending. Empty until commit 6's dual-write flag is on for
   * the deal. New step-based UI should read from here; legacy components
   * continue to read from {@link FinanceDealWorkspace.executionPlan}.
   */
  executionSteps: FinanceDealPaymentStep[];
  quoteHistory: FinanceDealQuoteItem[];
};

export async function getFinanceDeals(
  search: FinanceDealsSearchParams = {},
): Promise<FinanceDealsListResult> {
  const filters = createFinanceDealFilters(search);
  const response = await requestOk(
    await fetchApi(createFinanceDealsPath(filters)),
    "Не удалось загрузить сделки казначейства",
  );
  const payload = await readJsonWithSchema(response, FinanceDealsResponseSchema);
  const filteredItems = payload.items
    .map<FinanceDealListItem>((item) => ({
      ...item,
      blockerState: deriveFinanceDealBlockerState(item),
    }))
    .filter((item) =>
      filters.blockerState ? item.blockerState === filters.blockerState : true,
    );
  const { sortBy, sortOrder } = resolveSort(search);
  const sortedItems = sortInMemory(filteredItems, {
    sortBy,
    sortOrder,
    sortMap: FINANCE_DEAL_SORT_MAP,
  });

  return paginateInMemory(sortedItems, resolvePagination(search));
}

const getFinanceDealWorkspaceByIdUncached = async (
  id: string,
): Promise<FinanceDealWorkspace | null> => {
  if (!DealIdSchema.safeParse(id).success) {
    return null;
  }

  const response = await fetchApi(
    `/v1/deals/${encodeURIComponent(id)}/finance-workspace`,
  );

  if (response.status === 404) {
    return null;
  }

  await requestOk(response, "Не удалось загрузить рабочий стол сделки");
  return readJsonWithSchema(response, FinanceDealWorkspaceSchema);
};

const getFinanceDealBreadcrumbByIdUncached = async (
  id: string,
): Promise<FinanceDealBreadcrumb | null> => {
  if (!DealIdSchema.safeParse(id).success) {
    return null;
  }

  const response = await fetchApi(
    `/v1/deals/${encodeURIComponent(id)}/finance-workspace`,
  );

  if (response.status === 404) {
    return null;
  }

  await requestOk(response, "Не удалось загрузить сделку");
  return readJsonWithSchema(response, FinanceDealBreadcrumbSchema);
};

const getFinanceDealWorkbenchByIdUncached = async (
  id: string,
): Promise<FinanceDealWorkbench | null> => {
  const workspace = await getFinanceDealWorkspaceByIdUncached(id);

  if (!workspace) {
    return null;
  }

  const [quoteHistory, calculationHistory] = await Promise.all([
    readOptionalSupplementalResource(
      `/v1/deals/${encodeURIComponent(id)}/quotes`,
      z.array(FinanceDealQuoteItemSchema),
    ),
    readOptionalSupplementalResource(
      `/v1/deals/${encodeURIComponent(id)}/calculations`,
      z.array(FinanceDealCalculationHistoryItemSchema),
    ),
  ]);

  return {
    ...workspace,
    calculationHistory: [...calculationHistory].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    ),
    executionSteps: [...workspace.relatedResources.paymentSteps].sort(
      (left, right) => (left.dealLegIdx ?? 0) - (right.dealLegIdx ?? 0),
    ),
    quoteHistory: [...quoteHistory].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    ),
  };
};

async function readOptionalSupplementalResource<TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  try {
    const response = await fetchApi(path);

    if (!response.ok) {
      return schema.parse([]);
    }

    return await readJsonWithSchema(response, schema);
  } catch {
    return schema.parse([]);
  }
}

export const getFinanceDealWorkbenchById = cache(
  getFinanceDealWorkbenchByIdUncached,
);

export const getFinanceDealBreadcrumbById = cache(
  getFinanceDealBreadcrumbByIdUncached,
);

export const getFinanceDealWorkspaceById = cache(
  getFinanceDealWorkspaceByIdUncached,
);

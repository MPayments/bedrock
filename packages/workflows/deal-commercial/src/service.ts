import type { AgreementsModule } from "@bedrock/agreements";
import {
  canDealCreateFormalDocuments,
  canDealWriteTreasuryOrFormalDocuments,
  type DealsModule,
} from "@bedrock/deals";
import type { DealDetails, DealTrace } from "@bedrock/deals/contracts";
import { DealTraceSchema } from "@bedrock/deals/contracts";
import type { DocumentsReadModel } from "@bedrock/documents/read-model";
import type { Logger } from "@bedrock/platform/observability/logger";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import { minorToAmountString } from "@bedrock/shared/money";
import type { TreasuryModule } from "@bedrock/treasury";
import type { PaymentStep, QuotePreviewRecord } from "@bedrock/treasury/contracts";
import type { DealExecutionWorkflow } from "@bedrock/workflow-deal-execution";
import { resolveDealInvoiceBillingSelection } from "@bedrock/workflow-deal-projections";
import type { DocumentDraftWorkflow } from "@bedrock/workflow-document-drafts";

import {
  extractAgreementCommercialDefaults,
  normalizeOptionalDecimalString,
} from "./commercial-pricing";

const FINAL_PAYOUT_EVIDENCE_PURPOSES = new Set([
  "swift_mt103",
  "settlement_confirmation",
  "bank_confirmation",
]);

type DealWorkflow = NonNullable<
  Awaited<ReturnType<DealsModule["deals"]["queries"]["findWorkflowById"]>>
>;
type CreateDraftRequestContext =
  Parameters<DocumentDraftWorkflow["createDraft"]>[0]["requestContext"];
type PreviewQuoteInput = Parameters<
  TreasuryModule["quotes"]["queries"]["previewQuote"]
>[0];
type CreateQuoteInput = Parameters<
  TreasuryModule["quotes"]["commands"]["createQuote"]
>[0];

export interface DealCommercialWorkflowDeps {
  agreements: Pick<AgreementsModule, "agreements">;
  dealExecution: Pick<DealExecutionWorkflow, "requestExecution">;
  deals: Pick<DealsModule, "deals">;
  documentDrafts: Pick<DocumentDraftWorkflow, "createDraft">;
  documentsReadModel: Pick<DocumentsReadModel, "listDealTraceRowsByDealId">;
  logger: Pick<Logger, "warn">;
  treasury: Pick<TreasuryModule, "paymentSteps" | "quotes">;
}

async function requireDeal(
  deps: DealCommercialWorkflowDeps,
  dealId: string,
) {
  const deal = await deps.deals.deals.queries.findById(dealId);

  if (!deal) {
    throw new NotFoundError("Deal", dealId);
  }

  return deal;
}

async function autoMaterializeAfterQuoteAccept(
  deps: DealCommercialWorkflowDeps,
  input: { actorUserId: string; dealId: string; quoteId: string },
): Promise<void> {
  try {
    await deps.dealExecution.requestExecution({
      actorUserId: input.actorUserId,
      comment: null,
      dealId: input.dealId,
      idempotencyKey: `auto-materialize:${input.quoteId}`,
    });
  } catch (materializeError) {
    deps.logger.warn("auto-materialize after accept-quote failed", {
      dealId: input.dealId,
      error:
        materializeError instanceof Error
          ? materializeError.message
          : String(materializeError),
      quoteId: input.quoteId,
    });

    try {
      await deps.deals.deals.commands.appendTimelineEvent({
        actorUserId: input.actorUserId,
        dealId: input.dealId,
        payload: {
          quoteId: input.quoteId,
          reason:
            materializeError instanceof Error
              ? materializeError.message
              : String(materializeError),
        },
        sourceRef: `materialize:auto:${input.quoteId}`,
        type: "materialization_failed",
        visibility: "internal",
      });
    } catch (timelineError) {
      deps.logger.warn(
        "failed to append materialization_failed timeline event",
        {
          dealId: input.dealId,
          error:
            timelineError instanceof Error
              ? timelineError.message
              : String(timelineError),
        },
      );
    }
  }
}

export function assertDealAllowsCommercialWrite(deal: DealDetails) {
  if (
    !canDealWriteTreasuryOrFormalDocuments({
      status: deal.status,
      type: deal.type,
    })
  ) {
    throw new ValidationError(
      `Deal ${deal.id} cannot start treasury quotes or formal documents from status ${deal.status}`,
    );
  }
}

function assertDealAllowsFormalDocumentCreate(deal: DealDetails) {
  if (
    !canDealCreateFormalDocuments({
      status: deal.status,
      type: deal.type,
    })
  ) {
    throw new ValidationError(
      `Deal ${deal.id} cannot create formal documents from status ${deal.status}; formal documents are available from status preparing_documents onwards`,
    );
  }
}

async function buildDealScopedQuoteInput(input: {
  deps: DealCommercialWorkflowDeps;
  dealId: string;
  quoteInput: unknown;
}): Promise<PreviewQuoteInput> {
  const deal = await requireDeal(input.deps, input.dealId);
  assertDealAllowsCommercialWrite(deal);

  const agreement = await input.deps.agreements.agreements.queries.findById(
    deal.agreementId,
  );
  if (!agreement) {
    throw new NotFoundError("Agreement", deal.agreementId);
  }

  const {
    fixedFeeAmount,
    fixedFeeCurrency,
    quoteMarkupBps,
    ...quoteBody
  } = input.quoteInput as {
    fixedFeeAmount?: string | null;
    fixedFeeCurrency?: string | null;
    quoteMarkupBps?: number | null;
  } & Record<string, unknown>;
  const defaults = extractAgreementCommercialDefaults({
    agreement,
    fallbackFixedFeeCurrency:
      typeof quoteBody.toCurrency === "string" ? quoteBody.toCurrency : null,
  });
  const hasFixedFeeOverride =
    fixedFeeAmount !== undefined || fixedFeeCurrency !== undefined;
  const normalizedFixedFeeAmount = hasFixedFeeOverride
    ? normalizeOptionalDecimalString(fixedFeeAmount, "fixedFeeAmount") ?? null
    : defaults.fixedFeeAmount;
  const normalizedFixedFeeCurrency = hasFixedFeeOverride
    ? fixedFeeCurrency?.trim().toUpperCase() || null
    : defaults.fixedFeeCurrency;
  const previewQuoteInput: PreviewQuoteInput = {
    ...(quoteBody as PreviewQuoteInput),
    commercialTerms: {
      agreementVersionId: defaults.agreementVersionId,
      agreementFeeBps: defaults.agreementFeeBps.toString(),
      quoteMarkupBps: (quoteMarkupBps ?? 0).toString(),
      fixedFeeAmount: normalizedFixedFeeAmount,
      fixedFeeCurrency: normalizedFixedFeeCurrency,
    },
  };

  return previewQuoteInput;
}

async function createDealScopedFormalDocument(
  deps: DealCommercialWorkflowDeps,
  input: {
    actorUserId: string;
    dealId: string;
    docType: string;
    idempotencyKey: string;
    payload: unknown;
    requestContext?: CreateDraftRequestContext;
    routeBodyDealId?: string | null;
  },
) {
  const deal = await requireDeal(deps, input.dealId);
  assertDealAllowsFormalDocumentCreate(deal);
  const workflow = await deps.deals.deals.queries.findWorkflowById(
    input.dealId,
  );
  if (!workflow) {
    throw new NotFoundError("Deal workflow", input.dealId);
  }

  if (input.routeBodyDealId && input.routeBodyDealId !== input.dealId) {
    throw new ValidationError(
      `Document dealId ${input.routeBodyDealId} does not match route deal ${input.dealId}`,
    );
  }

  let payload = input.payload;
  if (input.docType === "application") {
    payload = await enrichDealScopedApplicationPayload({
      deps,
      deal,
      dealId: input.dealId,
      payload,
      workflow,
    });
  } else if (input.docType === "invoice") {
    assertPaymentApplicationReady({ workflow });
    payload = await enrichDealScopedInvoicePayload({
      deps,
      dealId: input.dealId,
      payload,
    });
  } else if (input.docType === "acceptance") {
    payload = await enrichDealScopedAcceptancePayload({
      deps,
      deal,
      dealId: input.dealId,
      payload,
      workflow,
    });
  }

  return deps.documentDrafts.createDraft({
    actorUserId: input.actorUserId,
    createIdempotencyKey: input.idempotencyKey,
    dealId: input.dealId,
    docType: input.docType,
    payload,
    requestContext: input.requestContext,
  });
}

function readObjectPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function readPayloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isReadyFormalDocument(input: {
  approvalStatus: string | null;
  lifecycleStatus: string | null;
  postingStatus: string | null;
  submissionStatus: string | null;
}) {
  return (
    input.lifecycleStatus === "active" &&
    input.submissionStatus === "submitted" &&
    (input.approvalStatus === "approved" ||
      input.approvalStatus === "not_required") &&
    (input.postingStatus === "posted" ||
      input.postingStatus === "not_required")
  );
}

function findFormalDocument(input: {
  docType: string;
  invoicePurpose?: string | null;
  workflow: DealWorkflow;
}) {
  return (
    input.workflow.relatedResources.formalDocuments.find((document) => {
      const invoicePurpose =
        document.docType === "invoice"
          ? (document.invoicePurpose ?? "combined")
          : null;

      return (
        document.docType === input.docType &&
        document.lifecycleStatus === "active" &&
        (input.invoicePurpose === undefined ||
          invoicePurpose === input.invoicePurpose)
      );
    }) ?? null
  );
}

function findReadyFormalDocument(input: Parameters<typeof findFormalDocument>[0]) {
  const document = findFormalDocument(input);
  return document && isReadyFormalDocument(document) ? document : null;
}

function findPrincipalInvoice(input: {
  workflow: Parameters<typeof findFormalDocument>[0]["workflow"];
}) {
  return (
    findReadyFormalDocument({
      docType: "invoice",
      invoicePurpose: "combined",
      workflow: input.workflow,
    }) ??
    findReadyFormalDocument({
      docType: "invoice",
      invoicePurpose: "principal",
      workflow: input.workflow,
    })
  );
}

function assertPaymentApplicationReady(input: {
  workflow: Parameters<typeof findFormalDocument>[0]["workflow"];
}) {
  if (input.workflow.summary.type !== "payment") {
    return;
  }

  if (
    !findReadyFormalDocument({
      docType: "application",
      workflow: input.workflow,
    })
  ) {
    throw new ValidationError(
      "invoice creation requires a ready application document for payment deals",
    );
  }
}

function requireWorkflowParticipantId(input: {
  role: "applicant" | "customer" | "internal_entity";
  field: "counterpartyId" | "customerId" | "organizationId";
  workflow: Parameters<typeof findFormalDocument>[0]["workflow"];
}) {
  const participant = input.workflow.participants.find(
    (item) => item.role === input.role,
  );
  const value = participant?.[input.field] ?? null;
  if (!value) {
    throw new ValidationError(
      `Deal ${input.workflow.summary.id} is missing ${input.role} ${input.field}`,
    );
  }

  return value;
}

async function enrichDealScopedApplicationPayload(input: {
  deps: DealCommercialWorkflowDeps;
  deal: DealDetails;
  dealId: string;
  payload: unknown;
  workflow: DealWorkflow;
}) {
  if (input.workflow.summary.type !== "payment") {
    throw new ValidationError("application documents are only available for payment deals");
  }
  if (
    findFormalDocument({
      docType: "application",
      workflow: input.workflow,
    })
  ) {
    throw new ValidationError("application already exists for this deal");
  }

  const acceptedQuote = input.workflow.acceptedQuote;
  if (!acceptedQuote || acceptedQuote.revokedAt) {
    throw new ValidationError("application creation requires a current accepted quote");
  }
  const calculationId = input.workflow.summary.calculationId;
  if (!calculationId) {
    throw new ValidationError("application creation requires a current calculation");
  }

  const agreement = await input.deps.agreements.agreements.queries.findById(
    input.deal.agreementId,
  );
  if (!agreement) {
    throw new NotFoundError("Agreement", input.deal.agreementId);
  }

  const sourcePayload = readObjectPayload(input.payload);
  const organizationRequisiteId =
    readPayloadString(sourcePayload, "organizationRequisiteId") ??
    agreement.organizationRequisiteId;
  const organizationId =
    readPayloadString(sourcePayload, "organizationId") ??
    input.workflow.participants.find((item) => item.role === "internal_entity")
      ?.organizationId ??
    agreement.organizationId;

  if (!organizationRequisiteId) {
    throw new ValidationError(
      "application creation requires an organization requisite",
    );
  }
  if (!organizationId) {
    throw new ValidationError("application creation requires an organization");
  }

  return {
    ...sourcePayload,
    calculationId,
    counterpartyId:
      input.workflow.intake.common.applicantCounterpartyId ??
      requireWorkflowParticipantId({
        field: "counterpartyId",
        role: "applicant",
        workflow: input.workflow,
      }),
    customerId: requireWorkflowParticipantId({
      field: "customerId",
      role: "customer",
      workflow: input.workflow,
    }),
    dealId: input.dealId,
    organizationId,
    organizationRequisiteId,
    quoteId: acceptedQuote.quoteId,
  };
}

async function listAllDealPaymentSteps(input: {
  deps: DealCommercialWorkflowDeps;
  dealId: string;
}) {
  const rows: PaymentStep[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const page = await input.deps.treasury.paymentSteps.queries.list({
      dealId: input.dealId,
      limit,
      offset,
      purpose: "deal_leg",
    });
    rows.push(...page.data);
    offset += page.limit;
    if (offset >= page.total) {
      break;
    }
  }

  return rows;
}

function isFinalPayoutStep(input: {
  step: PaymentStep;
  workflow: Parameters<typeof findFormalDocument>[0]["workflow"];
}) {
  if (input.step.kind !== "payout" || input.step.state !== "completed") {
    return false;
  }

  const finalPayoutLeg =
    input.workflow.executionPlan
      .filter((leg) => leg.kind === "payout")
      .sort((left, right) => right.idx - left.idx)[0] ?? null;
  if (!finalPayoutLeg) {
    return false;
  }

  return (
    (finalPayoutLeg.id !== null &&
      input.step.origin.planLegId === finalPayoutLeg.id) ||
    input.step.origin.sequence === finalPayoutLeg.idx
  );
}

async function enrichDealScopedAcceptancePayload(input: {
  deps: DealCommercialWorkflowDeps;
  deal: DealDetails;
  dealId: string;
  payload: unknown;
  workflow: DealWorkflow;
}) {
  if (input.workflow.summary.type !== "payment") {
    throw new ValidationError("acceptance documents are only available for payment deals");
  }
  if (input.workflow.summary.status !== "closing_documents") {
    throw new ValidationError(
      "acceptance can be created only in closing_documents status",
    );
  }

  if (
    findFormalDocument({
      docType: "acceptance",
      workflow: input.workflow,
    })
  ) {
    throw new ValidationError("acceptance already exists for this deal");
  }

  const application = findReadyFormalDocument({
    docType: "application",
    workflow: input.workflow,
  });
  if (!application) {
    throw new ValidationError("acceptance requires a ready application document");
  }

  const invoice = findPrincipalInvoice({ workflow: input.workflow });
  if (!invoice) {
    throw new ValidationError("acceptance requires a ready principal invoice");
  }

  const paymentSteps = await listAllDealPaymentSteps({
    deps: input.deps,
    dealId: input.dealId,
  });
  const finalPayout = paymentSteps.find((step) =>
    isFinalPayoutStep({ step, workflow: input.workflow }),
  );
  if (!finalPayout) {
    throw new ValidationError(
      "acceptance requires a completed final payout step",
    );
  }

  const settlementEvidenceFileAssetIds = finalPayout.artifacts
    .filter((artifact) => FINAL_PAYOUT_EVIDENCE_PURPOSES.has(artifact.purpose))
    .map((artifact) => artifact.fileAssetId);
  if (settlementEvidenceFileAssetIds.length === 0) {
    throw new ValidationError(
      "acceptance requires final SWIFT/MT103 payout evidence",
    );
  }

  const sourcePayload = readObjectPayload(input.payload);

  return {
    ...sourcePayload,
    applicationDocumentId: application.id,
    invoiceDocumentId: invoice.id,
    settlementEvidenceFileAssetIds,
  };
}

function readInvoicePurpose(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "combined";
  }

  const value = (payload as Record<string, unknown>).invoicePurpose;
  return value === "principal" || value === "agency_fee" ? value : "combined";
}

async function enrichDealScopedInvoicePayload(input: {
  deps: DealCommercialWorkflowDeps;
  dealId: string;
  payload: unknown;
}) {
  const purpose = readInvoicePurpose(input.payload);

  if (purpose === "combined") {
    return input.payload;
  }

  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    return input.payload;
  }

  const workflow = await input.deps.deals.deals.queries.findWorkflowById(
    input.dealId,
  );
  const quoteId = workflow?.acceptedQuote?.quoteId ?? null;
  if (!quoteId) {
    throw new ValidationError(
      "Split invoice creation requires an accepted quote",
    );
  }

  const quoteDetails = await input.deps.treasury.quotes.queries.getQuoteDetails({
    quoteRef: quoteId,
  });
  const selection = resolveDealInvoiceBillingSelection({
    dealId: input.dealId,
    invoicePurpose: purpose,
    quoteDetails,
  });
  const sourcePayload = input.payload as Record<string, unknown>;

  return {
    ...sourcePayload,
    amount: minorToAmountString(selection.amountMinor, {
      currency: selection.currency,
    }),
    billingSetRef: selection.billingSetRef,
    currency: selection.currency,
    invoicePurpose: selection.invoicePurpose,
    quoteComponentIds: selection.quoteComponentIds,
  };
}

async function buildDealTrace(
  deps: DealCommercialWorkflowDeps,
  dealId: string,
): Promise<DealTrace> {
  const deal = await requireDeal(deps, dealId);
  const [quotesResult, documentRows] = await Promise.all([
    deps.treasury.quotes.queries.listQuotes({
      dealId,
      limit: 500,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    deps.documentsReadModel.listDealTraceRowsByDealId(dealId),
  ]);

  const formalDocuments = documentRows.map((row) => ({
    approvalStatus: row.approvalStatus,
    dealId: row.dealId,
    docType: row.docType,
    id: row.documentId,
    ledgerOperationIds: row.ledgerOperationIds,
    lifecycleStatus: row.lifecycleStatus,
    occurredAt: row.occurredAt,
    postingStatus: row.postingStatus,
    submissionStatus: row.submissionStatus,
  }));
  const ledgerOperationIds = [
    ...new Set(formalDocuments.flatMap((row) => row.ledgerOperationIds)),
  ];
  const trace = {
    calculationId: deal.calculationId,
    dealId: deal.id,
    formalDocuments,
    generatedFiles: [],
    ledgerOperationIds,
    quotes: quotesResult.data.map((quote) => ({
      createdAt: quote.createdAt,
      dealId: quote.dealId,
      expiresAt: quote.expiresAt,
      id: quote.id,
      status: quote.status,
      usedDocumentId: quote.usedDocumentId,
    })),
    status: deal.status,
    type: deal.type,
  };

  return DealTraceSchema.parse(trace);
}

export function createDealCommercialWorkflow(
  deps: DealCommercialWorkflowDeps,
) {
  return {
    autoMaterializeAfterQuoteAccept: (
      input: Parameters<typeof autoMaterializeAfterQuoteAccept>[1],
    ) => autoMaterializeAfterQuoteAccept(deps, input),
    buildTrace: (input: { dealId: string }) =>
      buildDealTrace(deps, input.dealId),
    createFormalDocument: (
      input: Parameters<typeof createDealScopedFormalDocument>[1],
    ) => createDealScopedFormalDocument(deps, input),
    async createQuote(input: {
      dealId: string;
      idempotencyKey: string;
      quoteInput: unknown;
    }) {
      const quoteInput = await buildDealScopedQuoteInput({
        dealId: input.dealId,
        deps,
        quoteInput: input.quoteInput,
      });
      const createQuoteInput: CreateQuoteInput = {
        ...(quoteInput as CreateQuoteInput),
        dealId: input.dealId,
        idempotencyKey: input.idempotencyKey,
      };

      return deps.treasury.quotes.commands.createQuote(createQuoteInput);
    },
    async previewQuote(input: {
      dealId: string;
      quoteInput: unknown;
    }): Promise<QuotePreviewRecord> {
      const quoteInput = await buildDealScopedQuoteInput({
        dealId: input.dealId,
        deps,
        quoteInput: input.quoteInput,
      });
      return deps.treasury.quotes.queries.previewQuote(quoteInput);
    },
    requireDeal: (input: { dealId: string }) => requireDeal(deps, input.dealId),
  };
}

export type DealCommercialWorkflow = ReturnType<
  typeof createDealCommercialWorkflow
>;

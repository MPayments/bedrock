import type { ReconciliationOperationLinkDto } from "@bedrock/reconciliation/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import { type PaymentStep } from "@bedrock/treasury/contracts";

import { deriveFinanceDealReadiness } from "../close-readiness";
import type {
  FinanceDealPaymentStep,
  FinanceDealWorkspaceProjection,
} from "../contracts";
import { isExecutionRequestAllowed } from "./instructions";
import {
  buildCashflowSummary,
  buildProfitabilitySnapshot,
} from "./profitability";
import {
  buildFinanceQuoteRequestContext,
  classifyFinanceQueue,
} from "./queue-classify";
import { buildFinanceRouteAttachment } from "./route-attachment";
import type { DealProjectionsWorkflowDeps } from "../shared/deps";
import {
  buildCrmDocumentRequirements,
  buildCrmEvidenceRequirements,
  buildCrmWorkbenchActions,
  serializeCrmPricingQuote,
} from "../shared/projection-builders";
import {
  getApplicantParticipant,
  getInternalEntityParticipant,
  isDealInTerminalStatus,
  isQuoteEligible,
} from "../shared/workflow-helpers";

function deriveLegStateFromStep(
  step: PaymentStep | undefined,
  manualOverride: "blocked" | "skipped" | null,
): "blocked" | "done" | "pending" | "ready" | "skipped" {
  if (manualOverride === "blocked") return "blocked";
  if (manualOverride === "skipped") return "skipped";
  if (!step) return "pending";

  switch (step.state) {
    case "completed":
      return "done";
    case "cancelled":
    case "skipped":
      return "skipped";
    case "failed":
    case "returned":
      return "blocked";
    case "draft":
    case "scheduled":
    case "pending":
    case "processing":
      return "ready";
  }
}

type FinanceWorkspaceDeps = Pick<
  DealProjectionsWorkflowDeps,
  | "calculations"
  | "currencies"
  | "deals"
  | "documentsReadModel"
  | "files"
  | "parties"
  | "reconciliation"
  | "treasury"
>;

function serializeFinanceDealPaymentStep(
  step: PaymentStep,
): FinanceDealPaymentStep {
  return {
    artifacts: step.artifacts,
    attempts: step.attempts.map((attempt) => ({
      attemptNo: attempt.attemptNo,
      createdAt: attempt.createdAt.toISOString(),
      id: attempt.id,
      outcome: attempt.outcome,
      outcomeAt: attempt.outcomeAt
        ? attempt.outcomeAt.toISOString()
        : null,
      paymentStepId: attempt.paymentStepId,
      providerRef: attempt.providerRef,
      providerSnapshot: attempt.providerSnapshot,
      submittedAt: attempt.submittedAt.toISOString(),
      updatedAt: attempt.updatedAt.toISOString(),
    })),
    completedAt: step.completedAt ? step.completedAt.toISOString() : null,
    createdAt: step.createdAt.toISOString(),
    dealId: step.dealId,
    dealLegIdx: step.dealLegIdx,
    dealLegRole: step.dealLegRole,
    failureReason: step.failureReason,
    fromAmountMinor:
      step.fromAmountMinor === null ? null : step.fromAmountMinor.toString(),
    fromCurrencyId: step.fromCurrencyId,
    fromParty: step.fromParty,
    id: step.id,
    kind: step.kind,
    postings: step.postings,
    purpose: step.purpose,
    rate: step.rate,
    scheduledAt: step.scheduledAt ? step.scheduledAt.toISOString() : null,
    state: step.state,
    submittedAt: step.submittedAt ? step.submittedAt.toISOString() : null,
    toAmountMinor:
      step.toAmountMinor === null ? null : step.toAmountMinor.toString(),
    toCurrencyId: step.toCurrencyId,
    toParty: step.toParty,
    treasuryBatchId: step.treasuryBatchId,
    updatedAt: step.updatedAt.toISOString(),
  };
}

export async function getFinanceDealWorkspaceProjection(
  deps: FinanceWorkspaceDeps,
  dealId: string,
): Promise<FinanceDealWorkspaceProjection | null> {
  const workflow = await deps.deals.deals.queries.findWorkflowById(dealId);

  if (!workflow) {
    return null;
  }

  const [
    attachments,
    currentCalculation,
    paymentStepsResult,
    quotesResult,
    pricingContext,
  ] = await Promise.all([
    deps.files.files.queries.listDealAttachments(dealId),
    workflow.summary.calculationId
      ? deps.calculations.calculations.queries.findById(
          workflow.summary.calculationId,
        )
      : Promise.resolve(null),
    deps.treasury.paymentSteps.queries.list({
      dealId,
      limit: 100,
      offset: 0,
      purpose: "deal_leg",
    }),
    deps.treasury.quotes.queries.listQuotes({
      dealId,
      limit: MAX_QUERY_LIST_LIMIT,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    deps.deals.deals.queries.findPricingContextByDealId({ dealId }),
  ]);

  const acceptedQuoteDetailsRecord = workflow.acceptedQuote?.quoteId
    ? await deps.treasury.quotes.queries
        .getQuoteDetails({
          quoteRef: workflow.acceptedQuote.quoteId,
        })
        .catch(() => null)
    : null;

  const financeRouteAttachment = await buildFinanceRouteAttachment({
    acceptedQuoteDetails: acceptedQuoteDetailsRecord,
    applicantCounterpartyId:
      workflow.intake.common.applicantCounterpartyId ?? null,
    beneficiaryCounterpartyId:
      workflow.intake.externalBeneficiary.beneficiaryCounterpartyId ?? null,
    currencies: deps.currencies,
    parties: deps.parties,
    pricingContext,
  });

  const actions = buildCrmWorkbenchActions(workflow);
  const attachmentRequirements = buildCrmEvidenceRequirements({
    attachments,
    workflow,
  });
  const formalDocumentRequirements = buildCrmDocumentRequirements(workflow);
  const openingInvoiceRequirement =
    formalDocumentRequirements.find(
      (requirement) =>
        requirement.stage === "opening" && requirement.docType === "invoice",
    ) ?? null;
  const activeExchangeDocument =
    workflow.relatedResources.formalDocuments.find(
      (document) => document.docType === "exchange",
    ) ?? null;
  const queueContext = classifyFinanceQueue(workflow);
  const paymentStepByLegIdx = new Map<number, PaymentStep>();
  for (const step of paymentStepsResult.data) {
    if (step.dealLegIdx !== null) {
      paymentStepByLegIdx.set(step.dealLegIdx, step);
    }
  }
  const reconciliationLinks =
    paymentStepsResult.data.length > 0
      ? await deps.reconciliation.links.listOperationLinks({
          operationIds: paymentStepsResult.data.map((step) => step.id),
        })
      : [];
  const reconciliationLinksByStepId = new Map(
    reconciliationLinks.map(
      (link): readonly [string, ReconciliationOperationLinkDto] => [
        link.operationId,
        link,
      ],
    ),
  );
  const {
    closeReadiness,
    reconciliationExceptions: readinessReconciliationExceptions,
    reconciliationSummary,
    terminalStepCount,
    totalStepCount,
  } = deriveFinanceDealReadiness({
    paymentStepByLegIdx,
    reconciliationLinksByStepId,
    workflow,
  });
  const reconciliationExceptions = readinessReconciliationExceptions.map(
    (exception) => ({
      ...exception,
      actions: {
        adjustmentDocumentDocType: null,
        canIgnore: exception.state === "open",
      },
    }),
  );
  const hasAnyMaterializedSteps = paymentStepsResult.data.length > 0;
  const acceptedQuoteDetails = workflow.acceptedQuote
    ? (quotesResult.data
        .map(serializeCrmPricingQuote)
        .find((quote) => quote.id === workflow.acceptedQuote?.quoteId) ??
      null)
    : null;
  const cashflowSummary = await buildCashflowSummary(
    paymentStepsResult.data,
    deps,
  );

  return {
    acceptedQuote: workflow.acceptedQuote,
    acceptedQuoteDetails,
    actions: {
      canCloseDeal: closeReadiness.ready,
      canCreateCalculation: false,
      canCreateQuote: false,
      canRequestExecution:
        !hasAnyMaterializedSteps && isExecutionRequestAllowed(workflow),
      canRunReconciliation:
        totalStepCount > 0 &&
        terminalStepCount === totalStepCount &&
        (reconciliationSummary.state === "pending" ||
          reconciliationSummary.state === "blocked"),
      canResolveExecutionBlocker: workflow.executionPlan.some(
        (leg) => leg.state === "blocked",
      ),
      canUploadAttachment: actions.canUploadAttachment,
    },
    attachmentRequirements,
    cashflowSummary,
    closeReadiness,
    executionPlan: workflow.executionPlan.map((leg) => {
      const manualOverride =
        leg.state === "blocked" || leg.state === "skipped" ? leg.state : null;
      const step = paymentStepByLegIdx.get(leg.idx);
      const computedState = deriveLegStateFromStep(step, manualOverride);
      return {
        ...leg,
        state: computedState,
        actions: {
          canCreateLegOperation:
            hasAnyMaterializedSteps &&
            !step &&
            computedState !== "blocked" &&
            computedState !== "skipped" &&
            !isDealInTerminalStatus(workflow),
          exchangeDocument:
            leg.kind === "convert" &&
            workflow.fundingResolution.state === "resolved" &&
            workflow.fundingResolution.strategy === "external_fx" &&
            openingInvoiceRequirement
              ? {
                  activeDocumentId: activeExchangeDocument?.id ?? null,
                  createAllowed:
                    openingInvoiceRequirement.state === "ready" &&
                    Boolean(openingInvoiceRequirement.activeDocumentId) &&
                    Boolean(workflow.summary.calculationId) &&
                    !activeExchangeDocument &&
                    !isDealInTerminalStatus(workflow),
                  docType: "exchange",
                  openAllowed: Boolean(activeExchangeDocument),
                }
              : null,
        },
      };
    }),
    formalDocumentRequirements,
    nextAction: workflow.nextAction,
    operationalState: workflow.operationalState,
    pricing: {
      ...buildFinanceQuoteRequestContext(workflow),
      quoteEligibility: isQuoteEligible(workflow),
      routeAttachment: financeRouteAttachment,
    },
    profitabilitySnapshot: await buildProfitabilitySnapshot(
      currentCalculation,
      deps,
      { acceptedQuoteDetails: acceptedQuoteDetailsRecord },
    ),
    queueContext,
    reconciliationSummary,
    relatedResources: {
      attachments,
      formalDocuments: workflow.relatedResources.formalDocuments,
      paymentSteps: paymentStepsResult.data.map(
        serializeFinanceDealPaymentStep,
      ),
      quotes: workflow.relatedResources.quotes,
      reconciliationExceptions,
    },
    summary: {
      ...workflow.summary,
      applicantDisplayName:
        getApplicantParticipant(workflow)?.displayName ?? null,
      internalEntityDisplayName:
        getInternalEntityParticipant(workflow)?.displayName ?? null,
    },
    timeline: workflow.timeline,
    workflow,
  };
}

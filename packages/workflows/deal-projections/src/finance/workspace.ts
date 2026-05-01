import type { ReconciliationOperationLinkDto } from "@bedrock/reconciliation/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import type {
  PaymentStep,
  QuoteExecution,
} from "@bedrock/treasury/contracts";

import { deriveFinanceDealReadiness } from "../close-readiness";
import type {
  FinanceDealRouteAttachment,
  FinanceDealPaymentStep,
  FinanceDealQuoteExecution,
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
  buildDealInvoiceBillingSplit,
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
  runtime: PaymentStep | QuoteExecution | undefined,
): "blocked" | "completed" | "not_materialized" | "processing" | "ready" | "skipped" {
  if (!runtime) return "not_materialized";

  switch (runtime.state) {
    case "completed":
      return "completed";
    case "cancelled":
    case "skipped":
      return "skipped";
    case "expired":
    case "failed":
    case "returned":
      return "blocked";
    case "draft":
    case "scheduled":
    case "pending":
      return "ready";
    case "processing":
      return "processing";
  }
}

type FinanceWorkspaceDeps = Pick<
  DealProjectionsWorkflowDeps,
  | "agreements"
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
  const serializeRoute = (route: PaymentStep["currentRoute"]) => ({
    ...route,
    fromAmountMinor:
      route.fromAmountMinor === null ? null : route.fromAmountMinor.toString(),
    toAmountMinor:
      route.toAmountMinor === null ? null : route.toAmountMinor.toString(),
  });

  return {
    amendments: step.amendments.map((amendment) => ({
      after: serializeRoute(amendment.after),
      before: serializeRoute(amendment.before),
      createdAt: amendment.createdAt.toISOString(),
      id: amendment.id,
    })),
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
    currentRoute: serializeRoute(step.currentRoute),
    createdAt: step.createdAt.toISOString(),
    dealId: step.dealId,
    failureReason: step.failureReason,
    fromAmountMinor:
      step.fromAmountMinor === null ? null : step.fromAmountMinor.toString(),
    fromCurrencyId: step.fromCurrencyId,
    fromParty: step.fromParty,
    id: step.id,
    kind: step.kind,
    origin: step.origin,
    plannedRoute: serializeRoute(step.plannedRoute),
    postingDocumentRefs: step.postingDocumentRefs,
    purpose: step.purpose,
    quoteId: step.quoteId,
    rate: step.rate,
    returns: step.returns.map((record) => ({
      ...record,
      amountMinor:
        record.amountMinor === null ? null : record.amountMinor.toString(),
      createdAt: record.createdAt.toISOString(),
      returnedAt: record.returnedAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    })),
    scheduledAt: step.scheduledAt ? step.scheduledAt.toISOString() : null,
    sourceRef: step.sourceRef,
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

function deriveQuoteExecutionParties(
  execution: QuoteExecution,
  routeAttachment: FinanceDealRouteAttachment | null,
): FinanceDealQuoteExecution["executionParties"] {
  if (execution.executionParties) return execution.executionParties;

  const sequence = execution.origin.sequence ?? execution.quoteLegIdx;
  if (!routeAttachment || !sequence) return null;

  const debitParticipant = routeAttachment.participants[sequence - 1];
  const creditParticipant = routeAttachment.participants[sequence];
  if (!debitParticipant?.entityId || !creditParticipant?.entityId) {
    return null;
  }

  return {
    creditParty: {
      displayName: creditParticipant.displayName,
      entityKind: creditParticipant.entityKind,
      id: creditParticipant.entityId,
      requisiteId: creditParticipant.requisiteId,
    },
    debitParty: {
      displayName: debitParticipant.displayName,
      entityKind: debitParticipant.entityKind,
      id: debitParticipant.entityId,
      requisiteId: debitParticipant.requisiteId,
    },
  };
}

function deriveQuoteExecutionPartiesFromSteps(
  execution: QuoteExecution,
  paymentStepBySequence: ReadonlyMap<number, PaymentStep>,
): FinanceDealQuoteExecution["executionParties"] {
  const sequence = execution.origin.sequence ?? execution.quoteLegIdx;
  if (!sequence) return null;

  const previousStep = paymentStepBySequence.get(sequence - 1);
  const nextStep = paymentStepBySequence.get(sequence + 1);
  const debitParty = previousStep?.toParty ?? nextStep?.fromParty ?? null;
  const creditParty = nextStep?.fromParty ?? previousStep?.toParty ?? null;

  if (!debitParty || !creditParty) return null;

  return {
    creditParty,
    debitParty,
  };
}

function serializeFinanceDealQuoteExecution(
  execution: QuoteExecution,
  paymentStepBySequence: ReadonlyMap<number, PaymentStep>,
  routeAttachment: FinanceDealRouteAttachment | null,
): FinanceDealQuoteExecution {
  const executionParties =
    deriveQuoteExecutionParties(
      execution,
      routeAttachment,
    ) ??
    deriveQuoteExecutionPartiesFromSteps(
      execution,
      paymentStepBySequence,
    );

  return {
    completedAt: execution.completedAt
      ? execution.completedAt.toISOString()
      : null,
    createdAt: execution.createdAt.toISOString(),
    dealId: execution.dealId,
    failureReason: execution.failureReason,
    fromAmountMinor: execution.fromAmountMinor.toString(),
    fromCurrencyId: execution.fromCurrencyId,
    id: execution.id,
    origin: execution.origin,
    postingDocumentRefs: execution.postingDocumentRefs,
    providerRef: execution.providerRef,
    providerSnapshot: execution.providerSnapshot,
    quoteId: execution.quoteId,
    quoteLegIdx: execution.quoteLegIdx,
    rateDen: execution.rateDen.toString(),
    rateNum: execution.rateNum.toString(),
    executionParties,
    sourceRef: execution.sourceRef,
    state: execution.state,
    submittedAt: execution.submittedAt
      ? execution.submittedAt.toISOString()
      : null,
    toAmountMinor: execution.toAmountMinor.toString(),
    toCurrencyId: execution.toCurrencyId,
    treasuryOrderId: execution.treasuryOrderId,
    updatedAt: execution.updatedAt.toISOString(),
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
    agreement,
    attachments,
    currentCalculation,
    paymentStepsResult,
    quoteExecutionsResult,
    quotesResult,
    pricingContext,
  ] = await Promise.all([
    deps.agreements.agreements.queries.findById(workflow.summary.agreementId),
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
    deps.treasury.quoteExecutions.queries.list({
      dealId,
      limit: 100,
      offset: 0,
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
  const feeBillingMode =
    pricingContext.commercialDraft.feeBillingMode ??
    agreement?.currentVersion.feeBillingMode ??
    "included_in_principal_invoice";
  const billingSplit = buildDealInvoiceBillingSplit({
    dealId,
    feeBillingMode,
    quoteDetails: acceptedQuoteDetailsRecord,
  });
  const formalDocumentRequirements = buildCrmDocumentRequirements(workflow, {
    feeBillingMode,
  });
  const openingInvoiceRequirement =
    formalDocumentRequirements.find(
      (requirement) =>
        requirement.stage === "opening" &&
        requirement.docType === "invoice" &&
        requirement.invoicePurpose !== "agency_fee",
    ) ?? null;
  const activeExchangeDocument =
    workflow.relatedResources.formalDocuments.find(
      (document) => document.docType === "exchange",
    ) ?? null;
  const queueContext = classifyFinanceQueue(workflow);
  const paymentStepByPlanLegId = new Map<string, PaymentStep>();
  const paymentStepBySequence = new Map<number, PaymentStep>();
  for (const step of paymentStepsResult.data) {
    if (
      step.origin.type === "deal_execution_leg" &&
      step.origin.planLegId !== null
    ) {
      paymentStepByPlanLegId.set(step.origin.planLegId, step);
    }
    if (
      step.origin.type === "deal_execution_leg" &&
      step.origin.sequence !== null
    ) {
      paymentStepBySequence.set(step.origin.sequence, step);
    }
  }
  const quoteExecutionByPlanLegId = new Map<string, QuoteExecution>();
  for (const execution of quoteExecutionsResult.data) {
    if (
      execution.origin.type === "deal_execution_leg" &&
      execution.origin.planLegId !== null
    ) {
      quoteExecutionByPlanLegId.set(execution.origin.planLegId, execution);
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
    paymentStepByPlanLegId,
    quoteExecutionByPlanLegId,
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
  const hasAnyMaterializedRuntime =
    hasAnyMaterializedSteps || quoteExecutionsResult.data.length > 0;
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
        !hasAnyMaterializedRuntime && isExecutionRequestAllowed(workflow),
      canRunReconciliation:
        totalStepCount > 0 &&
        terminalStepCount === totalStepCount &&
        (reconciliationSummary.state === "pending" ||
          reconciliationSummary.state === "blocked"),
      canResolveExecutionBlocker: paymentStepsResult.data.some(
        (step) => step.state === "failed" || step.state === "returned",
      ),
      canUploadAttachment: actions.canUploadAttachment,
    },
    attachmentRequirements,
    cashflowSummary,
    closeReadiness,
    executionPlan: workflow.executionPlan.map((leg) => {
      const step = leg.id ? paymentStepByPlanLegId.get(leg.id) : undefined;
      const quoteExecution = leg.id
        ? quoteExecutionByPlanLegId.get(leg.id)
        : undefined;
      const runtimeState = deriveLegStateFromStep(
        leg.kind === "convert"
          ? (quoteExecution ?? step)
          : (step ?? quoteExecution),
      );
      return {
        fromCurrencyId: leg.fromCurrencyId,
        id: leg.id,
        idx: leg.idx,
        kind: leg.kind,
        routeSnapshotLegId: leg.routeSnapshotLegId,
        runtimeState,
        toCurrencyId: leg.toCurrencyId,
        actions: {
          canCreateLegOperation:
            hasAnyMaterializedRuntime &&
            !step &&
            !quoteExecution &&
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
                  invoicePurpose: null,
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
      billingSplit,
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
      quoteExecutions: quoteExecutionsResult.data.map(
        (execution) =>
          serializeFinanceDealQuoteExecution(
            execution,
            paymentStepBySequence,
            financeRouteAttachment,
          ),
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

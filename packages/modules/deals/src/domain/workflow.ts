import type { PaymentRouteDraft } from "@bedrock/treasury/model";

import {
  DEAL_REQUIRED_SECTION_IDS_BY_TYPE,
  type DEAL_LEG_KIND_VALUES,
} from "./constants";
import type {
  DealFundingResolution,
  DealIntakeDraft,
  DealQuoteAcceptance,
  DealRelatedFormalDocument,
  DealSectionCompleteness,
  DealStatus,
  DealTransitionReadiness,
  DealType,
  DealTimelineEvent,
  DealWorkflowLeg,
} from "./model";

const NEXT_PROGRESS_STATUS_BY_STATUS: Partial<Record<DealStatus, DealStatus>> = {
  awaiting_funds: "awaiting_payment",
  awaiting_payment: "closing_documents",
  closing_documents: "done",
  preparing_documents: "awaiting_funds",
  submitted: "preparing_documents",
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function hasMoneyAmount(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function hasBankInstruction(input: DealIntakeDraft["externalBeneficiary"]["bankInstructionSnapshot"] | DealIntakeDraft["settlementDestination"]["bankInstructionSnapshot"] | null): boolean {
  if (!input) {
    return false;
  }

  return Boolean(
    hasText(input.beneficiaryName) &&
      (hasText(input.accountNo) || hasText(input.iban)) &&
      (hasText(input.swift) || hasText(input.bic)),
  );
}

function hasCounterpartySnapshot(
  input:
    | DealIntakeDraft["incomingReceipt"]["payerSnapshot"]
    | DealIntakeDraft["externalBeneficiary"]["beneficiarySnapshot"]
    | null,
): boolean {
  if (!input) {
    return false;
  }

  return hasText(input.displayName) || hasText(input.legalName);
}

export function dealIntakeHasConvertLeg(intake: DealIntakeDraft): boolean {
  return Boolean(
    intake.moneyRequest.targetCurrencyId &&
      intake.moneyRequest.sourceCurrencyId &&
      intake.moneyRequest.targetCurrencyId !==
        intake.moneyRequest.sourceCurrencyId,
  );
}

function isAcceptedQuoteCurrentAndExecutable(input: {
  acceptance: DealQuoteAcceptance | null;
  now: Date;
}): boolean {
  const acceptance = input.acceptance;

  if (!acceptance) {
    return false;
  }

  if (acceptance.dealRevision < 1) {
    return false;
  }

  if (acceptance.quoteStatus !== "active") {
    return false;
  }

  if (acceptance.expiresAt && acceptance.expiresAt.getTime() <= input.now.getTime()) {
    return false;
  }

  return true;
}

export function evaluateDealSectionCompleteness(
  intake: DealIntakeDraft,
): DealSectionCompleteness[] {
  const result: DealSectionCompleteness[] = [];

  const commonBlockingReasons: string[] = [];
  if (!intake.common.applicantCounterpartyId) {
    commonBlockingReasons.push("Applicant is required");
  }
  if (!intake.common.requestedExecutionDate) {
    commonBlockingReasons.push("Requested execution date is required");
  }
  result.push({
    blockingReasons: commonBlockingReasons,
    complete: commonBlockingReasons.length === 0,
    sectionId: "common",
  });

  const moneyRequestBlockingReasons: string[] = [];
  if (intake.type === "payment") {
    if (!hasMoneyAmount(intake.incomingReceipt.expectedAmount)) {
      moneyRequestBlockingReasons.push("Payment amount is required");
    }
    if (!intake.moneyRequest.targetCurrencyId) {
      moneyRequestBlockingReasons.push("Payment currency is required");
    }
  } else if (!hasMoneyAmount(intake.moneyRequest.sourceAmount)) {
    moneyRequestBlockingReasons.push("Source amount is required");
  }
  if (!intake.moneyRequest.sourceCurrencyId) {
    moneyRequestBlockingReasons.push("Source currency is required");
  }
  if (
    intake.type === "currency_exchange" &&
    !dealIntakeHasConvertLeg(intake)
  ) {
    moneyRequestBlockingReasons.push(
      "Exchange deals require a different target currency",
    );
  }
  result.push({
    blockingReasons: moneyRequestBlockingReasons,
    complete: moneyRequestBlockingReasons.length === 0,
    sectionId: "moneyRequest",
  });

  const incomingReceiptBlockingReasons: string[] = [];
  if (!hasMoneyAmount(intake.incomingReceipt.expectedAmount)) {
    incomingReceiptBlockingReasons.push("Expected amount is required");
  }
  if (!hasText(intake.incomingReceipt.invoiceNumber)) {
    incomingReceiptBlockingReasons.push("Invoice number is required");
  }
  if (!hasText(intake.incomingReceipt.contractNumber)) {
    incomingReceiptBlockingReasons.push("Contract number is required");
  }
  if (
    !intake.incomingReceipt.payerCounterpartyId &&
    !hasCounterpartySnapshot(intake.incomingReceipt.payerSnapshot)
  ) {
    incomingReceiptBlockingReasons.push("External payer is required");
  }
  result.push({
    blockingReasons: incomingReceiptBlockingReasons,
    complete: incomingReceiptBlockingReasons.length === 0,
    sectionId: "incomingReceipt",
  });

  const externalBeneficiaryBlockingReasons: string[] = [];
  if (
    !intake.externalBeneficiary.beneficiaryCounterpartyId &&
    !hasCounterpartySnapshot(intake.externalBeneficiary.beneficiarySnapshot)
  ) {
    externalBeneficiaryBlockingReasons.push("External beneficiary is required");
  }
  if (!hasBankInstruction(intake.externalBeneficiary.bankInstructionSnapshot)) {
    externalBeneficiaryBlockingReasons.push(
      "Beneficiary bank instructions are required",
    );
  }
  result.push({
    blockingReasons: externalBeneficiaryBlockingReasons,
    complete: externalBeneficiaryBlockingReasons.length === 0,
    sectionId: "externalBeneficiary",
  });

  const settlementDestinationBlockingReasons: string[] = [];
  if (!intake.settlementDestination.mode) {
    settlementDestinationBlockingReasons.push("Settlement mode is required");
  } else if (
    intake.settlementDestination.mode === "applicant_requisite" &&
    !intake.settlementDestination.requisiteId
  ) {
    settlementDestinationBlockingReasons.push("Applicant requisite is required");
  } else if (
    intake.settlementDestination.mode === "manual" &&
    !hasBankInstruction(intake.settlementDestination.bankInstructionSnapshot)
  ) {
    settlementDestinationBlockingReasons.push(
      "Manual settlement bank instructions are required",
    );
  }
  result.push({
    blockingReasons: settlementDestinationBlockingReasons,
    complete: settlementDestinationBlockingReasons.length === 0,
    sectionId: "settlementDestination",
  });

  return result;
}

function isRequiredDealSectionComplete(
  type: DealType,
  completeness: DealSectionCompleteness[],
): boolean {
  const requiredSections = DEAL_REQUIRED_SECTION_IDS_BY_TYPE[type];
  const byId = new Map(completeness.map((item) => [item.sectionId, item]));

  return requiredSections.every((sectionId) => byId.get(sectionId)?.complete);
}

interface LegOverrides {
  fromCurrencyId?: string | null;
  routeSnapshotLegId?: string | null;
  toCurrencyId?: string | null;
}

function createLeg(
  idx: number,
  kind: (typeof DEAL_LEG_KIND_VALUES)[number],
  overrides: LegOverrides = {},
): DealWorkflowLeg {
  return {
    fromCurrencyId: overrides.fromCurrencyId ?? null,
    id: null,
    idx,
    kind,
    operationRefs: [],
    routeSnapshotLegId: overrides.routeSnapshotLegId ?? null,
    state: "pending",
    toCurrencyId: overrides.toCurrencyId ?? null,
  };
}

function mapRouteLegToDealLeg(
  idx: number,
  routeLeg: PaymentRouteDraft["legs"][number],
  participants: PaymentRouteDraft["participants"],
  routeLegIndex: number,
): DealWorkflowLeg {
  const fromParticipant = participants[routeLegIndex] ?? null;
  const toParticipant = participants[routeLegIndex + 1] ?? null;
  const kind =
    fromParticipant?.role === "source"
      ? "collect"
      : toParticipant?.role === "destination"
        ? "payout"
        : routeLeg.fromCurrencyId === routeLeg.toCurrencyId
          ? "transit_hold"
          : "convert";

  return createLeg(idx, kind, {
    fromCurrencyId: routeLeg.fromCurrencyId,
    routeSnapshotLegId: routeLeg.id,
    toCurrencyId: routeLeg.toCurrencyId,
  });
}

function buildCanonicalDealExecutionPlan(
  intake: DealIntakeDraft,
): DealWorkflowLeg[] {
  const hasConvert = dealIntakeHasConvertLeg(intake);

  switch (intake.type) {
    case "payment":
      return [
        createLeg(1, "collect"),
        ...(hasConvert ? [createLeg(2, "convert")] : []),
        createLeg(hasConvert ? 3 : 2, "payout"),
      ];
    case "currency_exchange":
      return [
        createLeg(1, "collect"),
        createLeg(2, "convert"),
        createLeg(3, "payout"),
      ];
    case "currency_transit":
      return [
        createLeg(1, "collect"),
        ...(hasConvert ? [createLeg(2, "convert")] : []),
        createLeg(hasConvert ? 3 : 2, "transit_hold"),
        createLeg(hasConvert ? 4 : 3, "payout"),
      ];
    case "exporter_settlement":
      return [
        createLeg(1, "payout"),
        createLeg(2, "collect"),
        ...(hasConvert ? [createLeg(3, "convert")] : []),
        createLeg(hasConvert ? 4 : 3, "settle_exporter"),
      ];
  }
}

function buildRouteDerivedDealExecutionPlan(
  _intake: DealIntakeDraft,
  routeSnapshot: PaymentRouteDraft,
): DealWorkflowLeg[] {
  return routeSnapshot.legs.map((routeLeg, offset) =>
    mapRouteLegToDealLeg(
      offset + 1,
      routeLeg,
      routeSnapshot.participants,
      offset,
    ),
  );
}

export function buildDealExecutionPlan(
  intake: DealIntakeDraft,
  routeSnapshot: PaymentRouteDraft | null = null,
): DealWorkflowLeg[] {
  if (routeSnapshot && routeSnapshot.legs.length > 0) {
    return buildRouteDerivedDealExecutionPlan(intake, routeSnapshot);
  }
  return buildCanonicalDealExecutionPlan(intake);
}

function hasPostedConvertDocument(
  documents: DealRelatedFormalDocument[],
): boolean {
  return documents.some(
    (document) =>
      ["exchange", "fx_execute"].includes(document.docType) &&
      document.lifecycleStatus === "active" &&
      document.postingStatus === "posted",
  );
}

function hasPostedTransferDocument(
  documents: DealRelatedFormalDocument[],
): boolean {
  return documents.some(
    (document) =>
      ["transfer_intra", "transfer_intercompany", "transfer_resolution"].includes(
        document.docType,
      ) &&
      document.lifecycleStatus === "active" &&
      document.postingStatus === "posted",
  );
}

function findStoredLegMatch(
  baseLeg: DealWorkflowLeg,
  storedLegs: DealWorkflowLeg[],
): DealWorkflowLeg | undefined {
  if (baseLeg.routeSnapshotLegId) {
    const bySnapshot = storedLegs.find(
      (leg) => leg.routeSnapshotLegId === baseLeg.routeSnapshotLegId,
    );
    if (bySnapshot) return bySnapshot;
  }
  return storedLegs.find(
    (leg) => leg.idx === baseLeg.idx && leg.kind === baseLeg.kind,
  );
}

export interface DealLegPaymentStepRef {
  planLegId: string;
  state:
    | "draft"
    | "scheduled"
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "returned"
    | "cancelled"
    | "skipped";
}

function deriveLegStateFromSteps(
  steps: DealLegPaymentStepRef[],
): DealWorkflowLeg["state"] | null {
  if (steps.length === 0) {
    return null;
  }

  if (steps.some((step) => step.state === "failed")) {
    return "blocked";
  }

  const terminalStates = new Set(["completed", "cancelled", "skipped"]);
  const allTerminal = steps.every((step) => terminalStates.has(step.state));
  if (allTerminal) {
    if (steps.some((step) => step.state === "completed")) {
      return "done";
    }
    return "skipped";
  }

  const inFlightStates = new Set([
    "scheduled",
    "pending",
    "processing",
    "returned",
    "completed",
  ]);
  if (steps.some((step) => inFlightStates.has(step.state))) {
    return "in_progress";
  }

  // All remaining: draft (materialized but no action taken yet)
  return "ready";
}

export function buildEffectiveDealExecutionPlan(input: {
  acceptance: DealQuoteAcceptance | null;
  documents: DealRelatedFormalDocument[];
  fundingResolution: DealFundingResolution;
  intake: DealIntakeDraft;
  now: Date;
  paymentSteps?: DealLegPaymentStepRef[];
  routeSnapshot: PaymentRouteDraft | null;
  storedLegs: DealWorkflowLeg[];
}): DealWorkflowLeg[] {
  const basePlan = buildDealExecutionPlan(input.intake, input.routeSnapshot);
  const merged = basePlan.map((leg) => {
    const match = findStoredLegMatch(leg, input.storedLegs);
    if (!match) return leg;
    return {
      ...leg,
      id: match.id ?? leg.id,
      operationRefs: match.operationRefs,
      state: match.state,
    };
  });
  const stepsByPlanLegId = new Map<string, DealLegPaymentStepRef[]>();
  for (const step of input.paymentSteps ?? []) {
    const bucket = stepsByPlanLegId.get(step.planLegId) ?? [];
    bucket.push(step);
    stepsByPlanLegId.set(step.planLegId, bucket);
  }
  const stepDerivedByPlanLegId = new Map<string, DealWorkflowLeg["state"]>();
  for (const [planLegId, steps] of stepsByPlanLegId.entries()) {
    const derived = deriveLegStateFromSteps(steps);
    if (derived) {
      stepDerivedByPlanLegId.set(planLegId, derived);
    }
  }
  const stepAware = merged.map((leg) => {
    const derived = leg.id ? stepDerivedByPlanLegId.get(leg.id) : undefined;
    if (derived) {
      return {
        ...leg,
        state: derived,
      };
    }
    return leg;
  });
  const hasExecutableAcceptedQuote = isAcceptedQuoteCurrentAndExecutable({
    acceptance: input.acceptance,
    now: input.now,
  });
  const hasExecutedConvert =
    input.acceptance?.quoteStatus === "used" ||
    hasPostedConvertDocument(input.documents);
  const downstreamLegs = stepAware.filter((leg) =>
    ["payout", "transit_hold", "settle_exporter"].includes(leg.kind),
  );
  const canAutoCompleteSingleDownstreamLeg =
    downstreamLegs.length === 1 && hasPostedTransferDocument(input.documents);
  const inventoryFundedRun =
    input.fundingResolution.state === "resolved" &&
    input.fundingResolution.strategy === "existing_inventory";

  return stepAware.map((leg) => {
    if (
      leg.kind === "convert" &&
      inventoryFundedRun &&
      leg.state !== "done" &&
      leg.state !== "skipped" &&
      leg.operationRefs.length === 0
    ) {
      return {
        ...leg,
        state: "skipped",
      };
    }

    if (
      leg.kind === "convert" &&
      leg.state !== "done" &&
      leg.state !== "skipped"
    ) {
      if (hasExecutedConvert) {
        return {
          ...leg,
          state: "done",
        };
      }

      if (hasExecutableAcceptedQuote && leg.state === "pending") {
        return {
          ...leg,
          state: "ready",
        };
      }
    }

    if (
      canAutoCompleteSingleDownstreamLeg &&
      ["payout", "transit_hold", "settle_exporter"].includes(leg.kind) &&
      leg.state !== "done" &&
      leg.state !== "skipped"
    ) {
      return {
        ...leg,
        state: "done",
      };
    }

    return leg;
  });
}

export function deriveDealNextAction(input: {
  acceptance: DealQuoteAcceptance | null;
  calculationId: string | null;
  completeness: DealSectionCompleteness[];
  executionPlan?: DealWorkflowLeg[];
  intake: DealIntakeDraft;
  now?: Date;
  transitionReadiness?: DealTransitionReadiness[];
  status: DealStatus;
}): string {
  if (!isRequiredDealSectionComplete(input.intake.type, input.completeness)) {
    return "Complete intake";
  }

  if (input.status === "draft") {
    return "Submit deal";
  }

  if (["done", "cancelled", "rejected"].includes(input.status)) {
    return "No action";
  }

  const nextProgressStatus =
    NEXT_PROGRESS_STATUS_BY_STATUS[input.status] ?? null;
  const allBlockers =
    input.transitionReadiness?.flatMap((item) => item.blockers) ?? [];
  const relevantBlockers =
    (nextProgressStatus
      ? input.transitionReadiness?.find(
          (item) => item.targetStatus === nextProgressStatus,
        )?.blockers
      : null) ?? allBlockers;

  if (
    relevantBlockers.some((blocker) =>
      ["operational_position_incomplete", "operational_position_blocked"].includes(
        blocker.code,
      ),
    )
  ) {
    return "Resolve operational state";
  }

  const now = input.now ?? new Date();
  const hasCurrentAcceptedQuote =
    isAcceptedQuoteCurrentAndExecutable({
      acceptance: input.acceptance,
      now,
    }) || input.acceptance?.quoteStatus === "used";

  if (dealIntakeHasConvertLeg(input.intake) && !hasCurrentAcceptedQuote) {
    return "Accept quote";
  }

  if (dealIntakeHasConvertLeg(input.intake) && !input.calculationId) {
    return "Create calculation from accepted quote";
  }

  if (
    relevantBlockers.some((blocker) =>
      ["approval_pending", "approval_rejected"].includes(blocker.code),
    )
  ) {
    return "Resolve approvals";
  }

  if (
    relevantBlockers.some((blocker) =>
      ["opening_document_missing", "opening_document_not_ready"].includes(
        blocker.code,
      ),
    )
  ) {
    return "Prepare documents";
  }

  if (
    relevantBlockers.some((blocker) =>
      ["execution_leg_blocked", "execution_leg_not_ready", "execution_leg_not_done"].includes(
        blocker.code,
      ),
    )
  ) {
    return "Update execution leg state";
  }

  if (
    relevantBlockers.some((blocker) =>
      ["closing_document_missing", "closing_document_not_ready"].includes(
        blocker.code,
      ),
    )
  ) {
    return "Prepare closing documents";
  }

  return "Continue processing";
}

export function filterTimelineForPortal(
  timeline: DealTimelineEvent[],
): DealTimelineEvent[] {
  return timeline.filter((event) => event.visibility === "customer_safe");
}

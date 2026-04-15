import {
  DEAL_REQUIRED_SECTION_IDS_BY_TYPE,
  type DEAL_LEG_KIND_VALUES,
} from "./constants";
import type {
  DealAcceptedCalculation,
  DealFundingResolution,
  DealHeader,
  DealRelatedFormalDocument,
  DealSectionCompleteness,
  DealTransitionReadiness,
  DealTimelineEvent,
  DealWorkflowLeg,
  DealWorkflowParticipant,
} from "../application/contracts/dto";
import type {
  DealSectionId,
  DealStatus,
  DealType,
} from "../application/contracts/zod";

const NEXT_PROGRESS_STATUS_BY_STATUS: Partial<Record<DealStatus, DealStatus>> = {
  draft: "pricing",
  pricing: "quoted",
  quoted: "awaiting_customer_approval",
  awaiting_customer_approval: "awaiting_internal_approval",
  awaiting_internal_approval: "approved_for_execution",
  approved_for_execution: "executing",
  executing: "partially_executed",
  partially_executed: "executed",
  executed: "reconciling",
  reconciling: "closed",
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function hasMoneyAmount(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function hasBankInstruction(input: DealHeader["externalBeneficiary"]["bankInstructionSnapshot"] | DealHeader["settlementDestination"]["bankInstructionSnapshot"] | null): boolean {
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
    | DealHeader["incomingReceipt"]["payerSnapshot"]
    | DealHeader["externalBeneficiary"]["beneficiarySnapshot"]
    | null,
): boolean {
  if (!input) {
    return false;
  }

  return hasText(input.displayName) || hasText(input.legalName);
}

export function dealHeaderHasConvertLeg(header: DealHeader): boolean {
  return Boolean(
    header.moneyRequest.targetCurrencyId &&
      header.moneyRequest.sourceCurrencyId &&
      header.moneyRequest.targetCurrencyId !==
        header.moneyRequest.sourceCurrencyId,
  );
}

export function evaluateDealSectionCompleteness(
  header: DealHeader,
): DealSectionCompleteness[] {
  const result: DealSectionCompleteness[] = [];

  const commonBlockingReasons: string[] = [];
  if (!header.common.applicantCounterpartyId) {
    commonBlockingReasons.push("Applicant is required");
  }
  if (!header.common.requestedExecutionDate) {
    commonBlockingReasons.push("Requested execution date is required");
  }
  result.push({
    blockingReasons: commonBlockingReasons,
    complete: commonBlockingReasons.length === 0,
    sectionId: "common",
  });

  const moneyRequestBlockingReasons: string[] = [];
  if (header.type === "payment") {
    if (!hasMoneyAmount(header.incomingReceipt.expectedAmount)) {
      moneyRequestBlockingReasons.push("Payment amount is required");
    }
    if (!header.moneyRequest.targetCurrencyId) {
      moneyRequestBlockingReasons.push("Payment currency is required");
    }
  } else if (!hasMoneyAmount(header.moneyRequest.sourceAmount)) {
    moneyRequestBlockingReasons.push("Source amount is required");
  }
  if (!header.moneyRequest.sourceCurrencyId) {
    moneyRequestBlockingReasons.push("Source currency is required");
  }
  if (
    header.type === "currency_exchange" &&
    !dealHeaderHasConvertLeg(header)
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
  if (!hasMoneyAmount(header.incomingReceipt.expectedAmount)) {
    incomingReceiptBlockingReasons.push("Expected amount is required");
  }
  if (!header.incomingReceipt.expectedCurrencyId) {
    incomingReceiptBlockingReasons.push("Expected currency is required");
  }
  if (!hasText(header.incomingReceipt.invoiceNumber)) {
    incomingReceiptBlockingReasons.push("Invoice number is required");
  }
  if (!hasText(header.incomingReceipt.contractNumber)) {
    incomingReceiptBlockingReasons.push("Contract number is required");
  }
  if (
    !header.incomingReceipt.payerCounterpartyId &&
    !hasCounterpartySnapshot(header.incomingReceipt.payerSnapshot)
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
    !header.externalBeneficiary.beneficiaryCounterpartyId &&
    !hasCounterpartySnapshot(header.externalBeneficiary.beneficiarySnapshot)
  ) {
    externalBeneficiaryBlockingReasons.push("External beneficiary is required");
  }
  if (!hasBankInstruction(header.externalBeneficiary.bankInstructionSnapshot)) {
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
  if (!header.settlementDestination.mode) {
    settlementDestinationBlockingReasons.push("Settlement mode is required");
  } else if (
    header.settlementDestination.mode === "applicant_requisite" &&
    !header.settlementDestination.requisiteId
  ) {
    settlementDestinationBlockingReasons.push("Applicant requisite is required");
  } else if (
    header.settlementDestination.mode === "manual" &&
    !hasBankInstruction(header.settlementDestination.bankInstructionSnapshot)
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

export function isRequiredDealSectionComplete(
  type: DealType,
  completeness: DealSectionCompleteness[],
): boolean {
  const requiredSections = DEAL_REQUIRED_SECTION_IDS_BY_TYPE[type] ?? [];
  const byId = new Map(completeness.map((item) => [item.sectionId, item]));

  return requiredSections.every((sectionId: DealSectionId) =>
    byId.get(sectionId)?.complete,
  );
}

function createLeg(
  idx: number,
  kind: (typeof DEAL_LEG_KIND_VALUES)[number],
): DealWorkflowLeg {
  return {
    id: null,
    idx,
    kind,
    operationRefs: [],
    state: "pending",
  };
}

export function buildDealExecutionPlan(header: DealHeader): DealWorkflowLeg[] {
  const hasConvert = dealHeaderHasConvertLeg(header);

  switch (header.type) {
    case "payment":
      return [
        createLeg(1, "collect"),
        ...(hasConvert ? [createLeg(2, "convert")] : []),
        createLeg(hasConvert ? 3 : 2, "payout"),
      ];
    case "currency_exchange":
      return [createLeg(1, "collect"), createLeg(2, "convert"), createLeg(3, "payout")];
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
    case "internal_treasury":
      return [
        createLeg(1, "collect"),
        ...(hasConvert ? [createLeg(2, "convert")] : []),
        createLeg(hasConvert ? 3 : 2, "payout"),
      ];
  }
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

export function buildEffectiveDealExecutionPlan(input: {
  acceptedCalculation: DealAcceptedCalculation | null;
  documents: DealRelatedFormalDocument[];
  fundingResolution: DealFundingResolution;
  header: DealHeader;
  now: Date;
  storedLegs: DealWorkflowLeg[];
}): DealWorkflowLeg[] {
  const basePlan = buildDealExecutionPlan(input.header);
  const storedByKey = new Map(
    input.storedLegs.map((leg) => [`${leg.idx}:${leg.kind}`, leg] as const),
  );
  const merged = basePlan.map((leg) => ({
    ...leg,
    id: storedByKey.get(`${leg.idx}:${leg.kind}`)?.id ?? leg.id,
    operationRefs:
      storedByKey.get(`${leg.idx}:${leg.kind}`)?.operationRefs ??
      leg.operationRefs,
    state: storedByKey.get(`${leg.idx}:${leg.kind}`)?.state ?? leg.state,
  }));
  const hasAcceptedCalculation = Boolean(input.acceptedCalculation);
  const hasExecutedConvert = hasPostedConvertDocument(input.documents);
  const downstreamLegs = merged.filter((leg) =>
    ["payout", "transit_hold", "settle_exporter"].includes(leg.kind),
  );
  const canAutoCompleteSingleDownstreamLeg =
    downstreamLegs.length === 1 && hasPostedTransferDocument(input.documents);

  return merged.map((leg) => {
    if (
      leg.kind === "convert" &&
      input.fundingResolution.state === "resolved" &&
      input.fundingResolution.strategy === "existing_inventory" &&
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

      if (hasAcceptedCalculation && leg.state === "pending") {
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
  calculationId: string | null;
  completeness: DealSectionCompleteness[];
  executionPlan?: DealWorkflowLeg[];
  header: DealHeader;
  now?: Date;
  transitionReadiness?: DealTransitionReadiness[];
  status: DealStatus;
}): string {
  if (!isRequiredDealSectionComplete(input.header.type, input.completeness)) {
    return "Complete deal header";
  }

  if (input.status === "pricing") {
    return "Compose route";
  }

  if (input.status === "quoted") {
    return "Accept calculation";
  }

  if (input.status === "awaiting_customer_approval") {
    return "Collect customer approval";
  }

  if (input.status === "awaiting_internal_approval") {
    return "Collect internal approval";
  }

  if (input.status === "approved_for_execution") {
    return "Request execution";
  }

  if (["executing", "partially_executed"].includes(input.status)) {
    return "Record execution actuals";
  }

  if (["executed", "reconciling"].includes(input.status)) {
    return "Reconcile and close";
  }

  if (["closed", "expired", "failed"].includes(input.status)) {
    return "No action";
  }

  if (input.status === "draft") {
    return "Submit deal";
  }

  if (["cancelled", "rejected"].includes(input.status)) {
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

  if (!input.calculationId) {
    return "Create calculation from route";
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

export function buildParticipantDisplayNameMap(
  participants: DealWorkflowParticipant[],
): Map<DealWorkflowParticipant["role"], string | null> {
  return new Map(
    participants.map((participant) => [participant.role, participant.displayName]),
  );
}

export function filterTimelineForPortal(
  timeline: DealTimelineEvent[],
): DealTimelineEvent[] {
  return timeline.filter((event) => event.visibility === "customer_safe");
}

export function summarizeRequiredSectionsByType(
  type: DealType,
): DealSectionId[] {
  return [...(DEAL_REQUIRED_SECTION_IDS_BY_TYPE[type] ?? [])];
}

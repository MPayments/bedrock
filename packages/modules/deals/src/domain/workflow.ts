import {
  DEAL_REQUIRED_SECTION_IDS_BY_TYPE,
  type DEAL_LEG_KIND_VALUES,
} from "./constants";
import type {
  DealIntakeDraft,
  DealQuoteAcceptance,
  DealRelatedFormalDocument,
  DealSectionCompleteness,
  DealTransitionReadiness,
  DealTimelineEvent,
  DealWorkflowLeg,
  DealWorkflowParticipant,
} from "../application/contracts/dto";
import type { DealSectionId, DealType } from "../application/contracts/zod";

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

export function isAcceptedQuoteCurrentAndExecutable(input: {
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
  if (!hasMoneyAmount(intake.moneyRequest.sourceAmount)) {
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
  if (!intake.incomingReceipt.expectedCurrencyId) {
    incomingReceiptBlockingReasons.push("Expected currency is required");
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

export function isRequiredDealSectionComplete(
  type: DealType,
  completeness: DealSectionCompleteness[],
): boolean {
  const requiredSections = DEAL_REQUIRED_SECTION_IDS_BY_TYPE[type];
  const byId = new Map(completeness.map((item) => [item.sectionId, item]));

  return requiredSections.every((sectionId) => byId.get(sectionId)?.complete);
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

export function buildDealExecutionPlan(intake: DealIntakeDraft): DealWorkflowLeg[] {
  const hasConvert = dealIntakeHasConvertLeg(intake);

  switch (intake.type) {
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
  }
}

function hasPostedFxExecuteDocument(
  documents: DealRelatedFormalDocument[],
): boolean {
  return documents.some(
    (document) =>
      document.docType === "fx_execute" &&
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
  acceptance: DealQuoteAcceptance | null;
  documents: DealRelatedFormalDocument[];
  intake: DealIntakeDraft;
  now: Date;
  storedLegs: DealWorkflowLeg[];
}): DealWorkflowLeg[] {
  const basePlan = buildDealExecutionPlan(input.intake);
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
  const hasExecutableAcceptedQuote = isAcceptedQuoteCurrentAndExecutable({
    acceptance: input.acceptance,
    now: input.now,
  });
  const hasExecutedConvert =
    input.acceptance?.quoteStatus === "used" ||
    hasPostedFxExecuteDocument(input.documents);
  const downstreamLegs = merged.filter((leg) =>
    ["payout", "transit_hold", "settle_exporter"].includes(leg.kind),
  );
  const canAutoCompleteSingleDownstreamLeg =
    downstreamLegs.length === 1 && hasPostedTransferDocument(input.documents);

  return merged.map((leg) => {
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
  status: string;
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

  const allBlockers =
    input.transitionReadiness?.flatMap((item) => item.blockers) ?? [];

  if (
    allBlockers.some((blocker) =>
      ["capability_pending", "capability_disabled"].includes(blocker.code),
    )
  ) {
    return "Resolve operational capability";
  }

  if (
    allBlockers.some((blocker) =>
      ["operational_position_incomplete", "operational_position_blocked"].includes(
        blocker.code,
      ),
    )
  ) {
    return "Resolve operational state";
  }

  const now = input.now ?? new Date();
  const hasCurrentAcceptedQuote = isAcceptedQuoteCurrentAndExecutable({
    acceptance: input.acceptance,
    now,
  });

  if (dealIntakeHasConvertLeg(input.intake) && !hasCurrentAcceptedQuote) {
    return "Accept quote";
  }

  if (dealIntakeHasConvertLeg(input.intake) && !input.calculationId) {
    return "Create calculation from accepted quote";
  }

  if (
    allBlockers.some((blocker) =>
      ["approval_pending", "approval_rejected"].includes(blocker.code),
    )
  ) {
    return "Resolve approvals";
  }

  if (
    allBlockers.some((blocker) =>
      ["opening_document_missing", "opening_document_not_ready"].includes(
        blocker.code,
      ),
    )
  ) {
    return "Prepare documents";
  }

  if (
    allBlockers.some((blocker) =>
      ["execution_leg_blocked", "execution_leg_not_ready", "execution_leg_not_done"].includes(
        blocker.code,
      ),
    )
  ) {
    return "Update execution leg state";
  }

  if (
    allBlockers.some((blocker) =>
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
  return [...DEAL_REQUIRED_SECTION_IDS_BY_TYPE[type]];
}

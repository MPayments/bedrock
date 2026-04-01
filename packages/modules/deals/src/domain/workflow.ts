import type {
  DealIntakeDraft,
  DealQuoteAcceptance,
  DealSectionCompleteness,
  DealTimelineEvent,
  DealWorkflowLeg,
  DealWorkflowParticipant,
} from "../application/contracts/dto";
import type { DealSectionId, DealType } from "../application/contracts/zod";
import {
  DEAL_REQUIRED_SECTION_IDS_BY_TYPE,
  type DEAL_LEG_KIND_VALUES,
} from "./constants";

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
  if (!hasMoneyAmount(intake.moneyRequest.sourceAmount)) {
    moneyRequestBlockingReasons.push("Source amount is required");
  }
  if (!intake.moneyRequest.sourceCurrencyId) {
    moneyRequestBlockingReasons.push("Source currency is required");
  }
  if (!hasText(intake.moneyRequest.purpose)) {
    moneyRequestBlockingReasons.push("Purpose is required");
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
    idx,
    kind,
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

export function deriveDealNextAction(input: {
  acceptance: DealQuoteAcceptance | null;
  calculationId: string | null;
  completeness: DealSectionCompleteness[];
  intake: DealIntakeDraft;
  now?: Date;
  status: string;
}): string {
  if (!isRequiredDealSectionComplete(input.intake.type, input.completeness)) {
    return "Complete intake";
  }

  if (input.status === "draft") {
    return "Submit deal";
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

  if (["done", "cancelled", "rejected"].includes(input.status)) {
    return "No action";
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

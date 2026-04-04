import { toMinorAmountString } from "@bedrock/shared/money";

import {
  applyCompatibilityRequestedFields,
} from "./compatibility-requested-fields";
import {
  buildDealExecutionPlan,
  deriveDealNextAction,
  evaluateDealSectionCompleteness,
} from "../../domain/workflow";
import type {
  CreateDealDraftInput,
  CreateDealInput,
  CreatePortalDealInput,
  UpdateDealIntakeInput,
} from "../contracts/commands";
import type {
  DealOperationalState,
  DealIntakeDraft,
  DealQuoteAcceptance,
  DealWorkflowLeg,
} from "../contracts/dto";
import type {
  CreateDealLegStoredInput,
  ReplaceDealOperationalPositionStoredInput,
  CreateDealParticipantStoredInput,
} from "../ports/deal.store";
import type {
  DealAgreementReference,
  DealReferencesPort,
} from "../ports/references.port";

export function createEmptyDealIntakeDraft(
  type: CreateDealDraftInput["intake"]["type"],
): DealIntakeDraft {
  return {
    common: {
      applicantCounterpartyId: null,
      customerNote: null,
      requestedExecutionDate: null,
    },
    externalBeneficiary: {
      bankInstructionSnapshot: null,
      beneficiaryCounterpartyId: null,
      beneficiarySnapshot: null,
    },
    incomingReceipt: {
      contractNumber: null,
      expectedAmount: null,
      expectedAt: null,
      expectedCurrencyId: null,
      invoiceNumber: null,
      payerCounterpartyId: null,
      payerSnapshot: null,
    },
    moneyRequest: {
      purpose: null,
      sourceAmount: null,
      sourceCurrencyId: null,
      targetCurrencyId: null,
    },
    settlementDestination: {
      bankInstructionSnapshot: null,
      mode: null,
      requisiteId: null,
    },
    type,
  };
}

export function buildPortalIntakeDraft(input: CreatePortalDealInput): DealIntakeDraft {
  const draft = createEmptyDealIntakeDraft(input.type);

  draft.common = {
    applicantCounterpartyId: input.common.applicantCounterpartyId,
    customerNote: input.common.customerNote ?? null,
    requestedExecutionDate: input.common.requestedExecutionDate ?? null,
  };
  draft.moneyRequest = {
    purpose: input.moneyRequest.purpose ?? null,
    sourceAmount: input.moneyRequest.sourceAmount ?? null,
    sourceCurrencyId: input.moneyRequest.sourceCurrencyId ?? null,
    targetCurrencyId: input.moneyRequest.targetCurrencyId ?? null,
  };

  if (
    input.type === "payment" ||
    input.type === "currency_transit" ||
    input.type === "exporter_settlement"
  ) {
    draft.incomingReceipt = {
      contractNumber: input.incomingReceipt?.contractNumber ?? null,
      expectedAmount: input.incomingReceipt?.expectedAmount ?? null,
      expectedAt: input.incomingReceipt?.expectedAt ?? null,
      expectedCurrencyId: input.incomingReceipt?.expectedCurrencyId ?? null,
      invoiceNumber: input.incomingReceipt?.invoiceNumber ?? null,
      payerCounterpartyId: null,
      payerSnapshot: null,
    };
  }

  return draft;
}

export function buildLegacyCreateIntakeDraft(input: CreateDealInput): DealIntakeDraft {
  const draft = createEmptyDealIntakeDraft(input.type);

  draft.common.applicantCounterpartyId = input.counterpartyId ?? null;
  draft.common.customerNote = input.comment ?? input.intakeComment ?? null;
  draft.moneyRequest.purpose = input.reason ?? null;
  applyCompatibilityRequestedFields({
    draft,
    requestedAmount: input.requestedAmount,
    requestedCurrencyId: input.requestedCurrencyId,
  });

  return draft;
}

export function applyLegacyIntakePatch(input: {
  current: DealIntakeDraft;
  patch: UpdateDealIntakeInput;
}): DealIntakeDraft {
  const next: DealIntakeDraft = {
    ...input.current,
    common: { ...input.current.common },
    externalBeneficiary: { ...input.current.externalBeneficiary },
    incomingReceipt: { ...input.current.incomingReceipt },
    moneyRequest: { ...input.current.moneyRequest },
    settlementDestination: { ...input.current.settlementDestination },
  };

  if (input.patch.counterpartyId !== undefined) {
    next.common.applicantCounterpartyId = input.patch.counterpartyId ?? null;
  }
  if (input.patch.comment !== undefined || input.patch.intakeComment !== undefined) {
    next.common.customerNote =
      input.patch.comment ??
      input.patch.intakeComment ??
      next.common.customerNote;
  }
  if (input.patch.reason !== undefined) {
    next.moneyRequest.purpose = input.patch.reason ?? null;
  }
  if (
    input.patch.requestedAmount !== undefined ||
    input.patch.requestedCurrencyId !== undefined
  ) {
    applyCompatibilityRequestedFields({
      draft: next,
      requestedAmount: input.patch.requestedAmount,
      requestedCurrencyId: input.patch.requestedCurrencyId,
    });
  }

  return next;
}

export async function deriveDealRootState(input: {
  acceptance: DealQuoteAcceptance | null;
  calculationId: string | null;
  intake: DealIntakeDraft;
  references: DealReferencesPort;
  status: string;
}) {
  const sourceCurrency = input.intake.moneyRequest.sourceCurrencyId
    ? await input.references.findCurrencyById(
        input.intake.moneyRequest.sourceCurrencyId,
      )
    : null;

  const sourceAmountMinor =
    input.intake.moneyRequest.sourceAmount && sourceCurrency
      ? BigInt(
          toMinorAmountString(
            input.intake.moneyRequest.sourceAmount,
            sourceCurrency.code,
          ),
        )
      : null;

  const sectionCompleteness = evaluateDealSectionCompleteness(input.intake);
  const nextAction = deriveDealNextAction({
    acceptance: input.acceptance,
    calculationId: input.calculationId,
    completeness: sectionCompleteness,
    intake: input.intake,
    status: input.status,
  });

  return {
    nextAction,
    sectionCompleteness,
    sourceAmountMinor,
    sourceCurrencyId: input.intake.moneyRequest.sourceCurrencyId ?? null,
    targetCurrencyId: input.intake.moneyRequest.targetCurrencyId ?? null,
  };
}

export function buildDealLegRows(input: {
  dealId: string;
  existingLegs?: DealWorkflowLeg[];
  generateUuid: () => string;
  intake: DealIntakeDraft;
}): CreateDealLegStoredInput[] {
  const existingLegStateByKey = new Map(
    (input.existingLegs ?? []).map((leg) => [`${leg.idx}:${leg.kind}`, leg.state] as const),
  );

  return buildDealExecutionPlan(input.intake).map((leg) => ({
    dealId: input.dealId,
    id: input.generateUuid(),
    idx: leg.idx,
    kind: leg.kind,
    state: existingLegStateByKey.get(`${leg.idx}:${leg.kind}`) ?? leg.state,
  }));
}

export function buildDealParticipantRows(input: {
  agreement: DealAgreementReference;
  customerId: string;
  dealId: string;
  generateUuid: () => string;
  intake: DealIntakeDraft;
}): CreateDealParticipantStoredInput[] {
  const participants: CreateDealParticipantStoredInput[] = [
    {
      counterpartyId: null,
      customerId: input.customerId,
      dealId: input.dealId,
      id: input.generateUuid(),
      organizationId: null,
      role: "customer",
    },
    {
      counterpartyId: null,
      customerId: null,
      dealId: input.dealId,
      id: input.generateUuid(),
      organizationId: input.agreement.organizationId,
      role: "internal_entity",
    },
  ];

  if (input.intake.common.applicantCounterpartyId) {
    participants.push({
      counterpartyId: input.intake.common.applicantCounterpartyId,
      customerId: null,
      dealId: input.dealId,
      id: input.generateUuid(),
      organizationId: null,
      role: "applicant",
    });
  }

  if (input.intake.incomingReceipt.payerCounterpartyId) {
    participants.push({
      counterpartyId: input.intake.incomingReceipt.payerCounterpartyId,
      customerId: null,
      dealId: input.dealId,
      id: input.generateUuid(),
      organizationId: null,
      role: "external_payer",
    });
  }

  if (input.intake.externalBeneficiary.beneficiaryCounterpartyId) {
    participants.push({
      counterpartyId: input.intake.externalBeneficiary.beneficiaryCounterpartyId,
      customerId: null,
      dealId: input.dealId,
      id: input.generateUuid(),
      organizationId: null,
      role: "external_beneficiary",
    });
  }

  return participants;
}

export function buildDealOperationalPositionRows(input: {
  dealId: string;
  generateUuid: () => string;
  operationalState: DealOperationalState;
}): ReplaceDealOperationalPositionStoredInput[] {
  return input.operationalState.positions.map((position) => ({
    amountMinor: position.amountMinor ? BigInt(position.amountMinor) : null,
    currencyId: position.currencyId,
    dealId: input.dealId,
    id: input.generateUuid(),
    kind: position.kind,
    reasonCode: position.reasonCode,
    sourceRefs: position.sourceRefs,
    state: position.state,
  }));
}

export function createTimelinePayloadEvent(input: {
  actorLabel?: string | null;
  actorUserId?: string | null;
  dealId: string;
  generateUuid: () => string;
  occurredAt: Date;
  payload?: Record<string, unknown>;
  sourceRef?: string | null;
  type:
    | "deal_created"
    | "intake_saved"
    | "participant_changed"
    | "status_changed"
    | "deal_closed"
    | "quote_created"
    | "quote_accepted"
    | "quote_expired"
    | "quote_used"
    | "execution_requested"
    | "leg_operation_created"
    | "instruction_prepared"
    | "instruction_submitted"
    | "instruction_settled"
    | "instruction_failed"
    | "instruction_retried"
    | "instruction_voided"
    | "return_requested"
    | "instruction_returned"
    | "execution_blocker_resolved"
    | "calculation_attached"
    | "attachment_uploaded"
    | "attachment_deleted"
    | "attachment_ingested"
    | "attachment_ingestion_failed"
    | "document_created"
    | "document_status_changed"
    | "leg_state_changed";
  visibility?: "customer_safe" | "internal";
}) {
  return {
    actorLabel: input.actorLabel ?? null,
    actorUserId: input.actorUserId ?? null,
    dealId: input.dealId,
    id: input.generateUuid(),
    occurredAt: input.occurredAt,
    payload: input.payload ?? {},
    sourceRef: input.sourceRef ?? null,
    type: input.type,
    visibility: input.visibility ?? "internal",
  } as const;
}

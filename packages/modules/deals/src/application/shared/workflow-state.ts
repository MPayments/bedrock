import { toMinorAmountString } from "@bedrock/shared/money";

import {
  buildDealExecutionPlan,
  deriveDealNextAction,
  evaluateDealSectionCompleteness,
} from "../../domain/workflow";
import type {
  CreateDealDraftInput,
  CreatePortalDealInput,
} from "../contracts/commands";
import type {
  DealHeader,
  DealOperationalState,
  DealWorkflowLeg,
} from "../contracts/dto";
import type { DealStatus } from "../contracts/zod";
import type {
  CreateDealLegStoredInput,
  ReplaceDealOperationalPositionStoredInput,
  CreateDealParticipantStoredInput,
} from "../ports/deal.store";
import type {
  DealAgreementReference,
  DealReferencesPort,
} from "../ports/references.port";

export function createEmptyDealHeader(
  type: CreateDealDraftInput["header"]["type"],
): DealHeader {
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

export function buildPortalDealHeader(input: CreatePortalDealInput): DealHeader {
  const draft = createEmptyDealHeader(input.type);

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

export async function deriveDealRootState(input: {
  calculationId: string | null;
  header: DealHeader;
  references: DealReferencesPort;
  status: DealStatus;
}) {
  const { header } = input;

  const sourceCurrency = header.moneyRequest.sourceCurrencyId
    ? await input.references.findCurrencyById(
        header.moneyRequest.sourceCurrencyId,
      )
    : null;

  const sourceAmountMinor =
    header.moneyRequest.sourceAmount && sourceCurrency
      ? BigInt(
          toMinorAmountString(
            header.moneyRequest.sourceAmount,
            sourceCurrency.code,
          ),
        )
      : null;

  const sectionCompleteness = evaluateDealSectionCompleteness(header);
  const nextAction = deriveDealNextAction({
    calculationId: input.calculationId,
    completeness: sectionCompleteness,
    header,
    status: input.status,
  });

  return {
    nextAction,
    sectionCompleteness,
    sourceAmountMinor,
    sourceCurrencyId: header.moneyRequest.sourceCurrencyId ?? null,
    targetCurrencyId: header.moneyRequest.targetCurrencyId ?? null,
  };
}

export function buildDealLegRows(input: {
  dealId: string;
  existingLegs?: DealWorkflowLeg[];
  generateUuid: () => string;
  header: DealHeader;
}): CreateDealLegStoredInput[] {
  const { header } = input;

  const existingLegStateByKey = new Map(
    (input.existingLegs ?? []).map((leg) => [`${leg.idx}:${leg.kind}`, leg.state] as const),
  );

  return buildDealExecutionPlan(header).map((leg) => ({
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
  header: DealHeader;
}): CreateDealParticipantStoredInput[] {
  const { header } = input;

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

  if (header.common.applicantCounterpartyId) {
    participants.push({
      counterpartyId: header.common.applicantCounterpartyId,
      customerId: null,
      dealId: input.dealId,
      id: input.generateUuid(),
      organizationId: null,
      role: "applicant",
    });
  }

  if (header.incomingReceipt.payerCounterpartyId) {
    participants.push({
      counterpartyId: header.incomingReceipt.payerCounterpartyId,
      customerId: null,
      dealId: input.dealId,
      id: input.generateUuid(),
      organizationId: null,
      role: "external_payer",
    });
  }

  if (header.externalBeneficiary.beneficiaryCounterpartyId) {
    participants.push({
      counterpartyId: header.externalBeneficiary.beneficiaryCounterpartyId,
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
    | "deal_header_updated"
    | "deal_approved"
    | "deal_rejected"
    | "participant_changed"
    | "status_changed"
    | "deal_closed"
    | "quote_created"
    | "quote_expired"
    | "quote_used"
    | "execution_requested"
    | "calculation_created"
    | "calculation_accepted"
    | "calculation_superseded"
    | "leg_operation_created"
    | "instruction_prepared"
    | "instruction_submitted"
    | "instruction_settled"
    | "instruction_failed"
    | "instruction_retried"
    | "instruction_voided"
    | "return_requested"
    | "instruction_returned"
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

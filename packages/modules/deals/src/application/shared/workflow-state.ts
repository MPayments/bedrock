import { toMinorAmountString } from "@bedrock/shared/money";
import type { PaymentRouteDraft } from "@bedrock/treasury/contracts";

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
  DealOperationalState,
  DealIntakeDraft,
  DealQuoteAcceptance,
  DealWorkflowLeg,
} from "../contracts/dto";
import type { DealStatus, DealTimelineEventType } from "../contracts/zod";
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
      invoiceNumber: input.incomingReceipt?.invoiceNumber ?? null,
      payerCounterpartyId: null,
      payerSnapshot: null,
    };
  }

  return draft;
}

export async function deriveDealRootState(input: {
  acceptance: DealQuoteAcceptance | null;
  calculationId: string | null;
  intake: DealIntakeDraft;
  references: DealReferencesPort;
  status: DealStatus;
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
  routeSnapshot?: PaymentRouteDraft | null;
}): CreateDealLegStoredInput[] {
  const existingLegs = input.existingLegs ?? [];
  const existingBySnapshotLegId = new Map<string, DealWorkflowLeg>();
  const existingByIdxKind = new Map<string, DealWorkflowLeg>();
  for (const leg of existingLegs) {
    if (leg.routeSnapshotLegId) {
      existingBySnapshotLegId.set(leg.routeSnapshotLegId, leg);
    }
    existingByIdxKind.set(`${leg.idx}:${leg.kind}`, leg);
  }

  const matchExisting = (
    plannedLeg: DealWorkflowLeg,
  ): DealWorkflowLeg | null => {
    if (plannedLeg.routeSnapshotLegId) {
      const bySnapshot = existingBySnapshotLegId.get(
        plannedLeg.routeSnapshotLegId,
      );
      if (bySnapshot) return bySnapshot;
    }
    return (
      existingByIdxKind.get(`${plannedLeg.idx}:${plannedLeg.kind}`) ?? null
    );
  };

  return buildDealExecutionPlan(input.intake, input.routeSnapshot ?? null).map(
    (plannedLeg) => {
      const existing = matchExisting(plannedLeg);
      return {
        dealId: input.dealId,
        fromCurrencyId: plannedLeg.fromCurrencyId,
        id: existing?.id ?? input.generateUuid(),
        idx: plannedLeg.idx,
        kind: plannedLeg.kind,
        routeSnapshotLegId: plannedLeg.routeSnapshotLegId,
        state: existing?.state ?? plannedLeg.state,
        toCurrencyId: plannedLeg.toCurrencyId,
      };
    },
  );
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
  type: DealTimelineEventType;
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

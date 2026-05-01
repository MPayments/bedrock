import { toMinorAmountString } from "@bedrock/shared/money";

import type { DealRouteVersionSnapshot } from "../../domain/route-version";
import {
  buildDealExecutionPlan,
  deriveDealNextAction,
  evaluateDealSectionCompleteness,
} from "../../domain/workflow";
import type {
  DealIntakeDraft,
  DealQuoteAcceptance,
  DealWorkflowLeg,
} from "../contracts/dto";
import type { DealStatus, DealTimelineEventType } from "../contracts/zod";
import type {
  CreateDealLegStoredInput,
  CreateDealParticipantStoredInput,
} from "../ports/deal.store";
import type {
  DealAgreementReference,
  DealReferencesPort,
} from "../ports/references.port";

export function normalizeDealIntakeDraft(
  intake: DealIntakeDraft,
): DealIntakeDraft {
  if (intake.type !== "payment") {
    return intake;
  }

  return {
    ...intake,
    moneyRequest: {
      ...intake.moneyRequest,
      sourceAmount: null,
    },
  };
}

export async function deriveDealRootState(input: {
  acceptance: DealQuoteAcceptance | null;
  calculationId: string | null;
  intake: DealIntakeDraft;
  references: DealReferencesPort;
  status: DealStatus;
}) {
  const intake = normalizeDealIntakeDraft(input.intake);
  const sourceCurrency = intake.moneyRequest.sourceCurrencyId
    ? await input.references.findCurrencyById(
        intake.moneyRequest.sourceCurrencyId,
      )
    : null;

  const sourceAmountMinor =
    intake.type !== "payment" &&
    intake.moneyRequest.sourceAmount &&
    sourceCurrency
      ? BigInt(
          toMinorAmountString(
            intake.moneyRequest.sourceAmount,
            sourceCurrency.code,
          ),
        )
      : null;

  const sectionCompleteness = evaluateDealSectionCompleteness(intake);
  const nextAction = deriveDealNextAction({
    acceptance: input.acceptance,
    calculationId: input.calculationId,
    completeness: sectionCompleteness,
    intake,
    status: input.status,
  });

  return {
    nextAction,
    sectionCompleteness,
    sourceAmountMinor,
    sourceCurrencyId: intake.moneyRequest.sourceCurrencyId ?? null,
    targetCurrencyId: intake.moneyRequest.targetCurrencyId ?? null,
  };
}

export function buildDealLegRows(input: {
  dealId: string;
  existingLegs?: DealWorkflowLeg[];
  generateUuid: () => string;
  intake: DealIntakeDraft;
  routeSnapshot?: DealRouteVersionSnapshot | null;
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
      counterpartyId:
        input.intake.externalBeneficiary.beneficiaryCounterpartyId,
      customerId: null,
      dealId: input.dealId,
      id: input.generateUuid(),
      organizationId: null,
      role: "external_beneficiary",
    });
  }

  return participants;
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

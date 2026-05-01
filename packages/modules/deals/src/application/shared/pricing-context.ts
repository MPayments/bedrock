import type {
  AttachDealPricingRouteInput,
  UpdateDealPricingContextInput,
} from "../contracts/commands";
import {
  DealPricingCommercialDraftSchema,
  DealPricingContextSchema,
  DealPricingContextSnapshotSchema,
  type DealPricingContext,
  type DealPricingContextSnapshot,
} from "../contracts/dto";
import {
  DealRouteVersionSnapshotSchema,
  type DealRouteFee,
} from "../../domain/route-version";

function createDefaultDealPricingContext(): DealPricingContext {
  return DealPricingContextSchema.parse({
    commercialDraft: {
      clientPricing: null,
      executionSource: { type: "route_execution" },
      fixedFeeAmount: null,
      fixedFeeCurrency: null,
      feeBillingMode: null,
      quoteMarkupBps: null,
    },
    fundingAdjustments: [],
    revision: 1,
    routeAttachment: null,
  });
}

export function createDefaultDealPricingContextSnapshot(): DealPricingContextSnapshot {
  const { revision: _revision, ...snapshot } =
    createDefaultDealPricingContext();
  return DealPricingContextSnapshotSchema.parse(snapshot);
}

function cloneDealPricingContext(
  input: DealPricingContext,
): DealPricingContext {
  return DealPricingContextSchema.parse(structuredClone(input));
}

function normalizeOptionalDecimalString(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  const normalized = value.trim().replace(",", ".");
  return normalized.length > 0 ? normalized : null;
}

export function normalizeStoredDealPricingContext(input: {
  revision: number | null | undefined;
  snapshot: unknown;
}): DealPricingContext {
  if (
    !input.snapshot ||
    input.revision === null ||
    input.revision === undefined
  ) {
    return createDefaultDealPricingContext();
  }

  return DealPricingContextSchema.parse({
    ...(input.snapshot as Record<string, unknown>),
    revision: Number(input.revision),
  });
}

export function attachDealPricingRouteSnapshot(input: {
  context: DealPricingContext;
  route: AttachDealPricingRouteInput;
  now: Date;
}): DealPricingContextSnapshot {
  const context = cloneDealPricingContext(input.context);

  return DealPricingContextSnapshotSchema.parse({
    ...context,
    routeAttachment: {
      attachedAt: input.now,
      snapshot: DealRouteVersionSnapshotSchema.parse(
        structuredClone(input.route.snapshot),
      ),
      templateId: input.route.templateId,
      templateName: input.route.templateName,
    },
  });
}

export function detachDealPricingRouteSnapshot(
  input: DealPricingContext,
): DealPricingContextSnapshot {
  const context = cloneDealPricingContext(input);

  return DealPricingContextSnapshotSchema.parse({
    ...context,
    routeAttachment: null,
  });
}

export interface DealLegRouteAmendment {
  executionCounterpartyId?: string | null;
  fees?: DealRouteFee[];
  legIdx: number;
  requisiteId?: string | null;
}

export function applyDealLegRouteAmendment(input: {
  amendment: DealLegRouteAmendment;
  context: DealPricingContext;
}): {
  after: {
    fees: DealRouteFee[];
    participant: Record<string, unknown> | null;
  };
  before: {
    fees: DealRouteFee[];
    participant: Record<string, unknown> | null;
  };
  snapshot: DealPricingContextSnapshot;
} {
  if (!input.context.routeAttachment) {
    throw new Error(
      "Cannot amend leg — deal has no attached payment route snapshot",
    );
  }

  const clone = cloneDealPricingContext(input.context);
  const attachment = clone.routeAttachment;

  if (!attachment) {
    throw new Error("Route attachment lost during clone");
  }

  const snapshotDraft = attachment.snapshot as unknown as {
    additionalFees: DealRouteFee[];
    amountInMinor: string;
    amountOutMinor: string;
    currencyInId: string;
    currencyOutId: string;
    legs: {
      fees: DealRouteFee[];
      fromCurrencyId: string;
      id: string;
      toCurrencyId: string;
    }[];
    lockedSide: string;
    participants: Record<string, unknown>[];
  };

  const legIndex = input.amendment.legIdx - 1;
  const leg = snapshotDraft.legs[legIndex];

  if (!leg) {
    throw new Error(
      `Route snapshot has no leg at index ${input.amendment.legIdx}`,
    );
  }

  const participantIndex = legIndex + 1;
  const participant = snapshotDraft.participants[participantIndex] ?? null;
  const beforeFees: DealRouteFee[] = structuredClone(leg.fees);
  const beforeParticipant: Record<string, unknown> | null = participant
    ? structuredClone(participant)
    : null;

  if (input.amendment.fees !== undefined) {
    leg.fees = structuredClone(input.amendment.fees);
  }

  if (participant) {
    if (input.amendment.executionCounterpartyId !== undefined) {
      if (input.amendment.executionCounterpartyId === null) {
        participant.binding = "abstract";
        participant.entityId = null;
        participant.entityKind = null;
        participant.requisiteId = null;
      } else {
        participant.binding = "bound";
        participant.entityId = input.amendment.executionCounterpartyId;
        if (
          participant.entityKind !== "counterparty" &&
          participant.entityKind !== "organization"
        ) {
          participant.entityKind = "counterparty";
        }
      }
    }

    if (input.amendment.requisiteId !== undefined) {
      participant.requisiteId = input.amendment.requisiteId;
    }
  }

  const nextSnapshot = DealPricingContextSnapshotSchema.parse({
    commercialDraft: clone.commercialDraft,
    fundingAdjustments: clone.fundingAdjustments,
    routeAttachment: {
      ...attachment,
      snapshot: DealRouteVersionSnapshotSchema.parse(snapshotDraft),
    },
  });

  const afterFees = nextSnapshot.routeAttachment!.snapshot.legs[legIndex]!.fees;
  const afterParticipant =
    (nextSnapshot.routeAttachment!.snapshot.participants[
      participantIndex
    ] as unknown as Record<string, unknown> | undefined) ?? null;

  return {
    after: {
      fees: afterFees,
      participant: afterParticipant ? structuredClone(afterParticipant) : null,
    },
    before: {
      fees: beforeFees,
      participant: beforeParticipant,
    },
    snapshot: nextSnapshot,
  };
}

export function applyDealPricingContextPatch(input: {
  context: DealPricingContext;
  patch: UpdateDealPricingContextInput;
}): DealPricingContextSnapshot {
  const next = cloneDealPricingContext(input.context);

  if (input.patch.commercialDraft) {
    const draftPatch = input.patch.commercialDraft;
    next.commercialDraft = DealPricingCommercialDraftSchema.parse({
      ...next.commercialDraft,
      ...draftPatch,
      fixedFeeAmount: normalizeOptionalDecimalString(
        draftPatch.fixedFeeAmount === undefined
          ? next.commercialDraft.fixedFeeAmount
          : draftPatch.fixedFeeAmount,
      ),
      fixedFeeCurrency:
        draftPatch.fixedFeeCurrency === undefined
          ? next.commercialDraft.fixedFeeCurrency
          : draftPatch.fixedFeeCurrency,
      feeBillingMode:
        draftPatch.feeBillingMode === undefined
          ? next.commercialDraft.feeBillingMode
          : draftPatch.feeBillingMode,
      clientPricing:
        draftPatch.clientPricing === undefined
          ? next.commercialDraft.clientPricing
          : draftPatch.clientPricing,
      executionSource:
        draftPatch.executionSource ?? next.commercialDraft.executionSource,
      quoteMarkupBps:
        draftPatch.quoteMarkupBps === undefined
          ? next.commercialDraft.quoteMarkupBps
          : draftPatch.quoteMarkupBps,
    });
  }

  if (input.patch.fundingAdjustments) {
    next.fundingAdjustments = structuredClone(input.patch.fundingAdjustments);
  }

  return DealPricingContextSnapshotSchema.parse({
    commercialDraft: next.commercialDraft,
    fundingAdjustments: next.fundingAdjustments,
    routeAttachment: next.routeAttachment,
  });
}

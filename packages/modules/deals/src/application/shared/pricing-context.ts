import { PaymentRouteDraftSchema } from "@bedrock/treasury/contracts";

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

export function createDefaultDealPricingContext(): DealPricingContext {
  return DealPricingContextSchema.parse({
    commercialDraft: {
      fixedFeeAmount: null,
      fixedFeeCurrency: null,
      quoteMarkupPercent: null,
    },
    fundingAdjustments: [],
    revision: 1,
    routeAttachment: null,
  });
}

export function createDefaultDealPricingContextSnapshot(): DealPricingContextSnapshot {
  const { revision: _revision, ...snapshot } = createDefaultDealPricingContext();
  return DealPricingContextSnapshotSchema.parse(snapshot);
}

export function cloneDealPricingContext(
  input: DealPricingContext,
): DealPricingContext {
  return DealPricingContextSchema.parse(structuredClone(input));
}

export function cloneDealPricingContextSnapshot(
  input: DealPricingContextSnapshot,
): DealPricingContextSnapshot {
  return DealPricingContextSnapshotSchema.parse(structuredClone(input));
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
  if (!input.snapshot || input.revision === null || input.revision === undefined) {
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
      snapshot: PaymentRouteDraftSchema.parse(structuredClone(input.route.snapshot)),
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

export function applyDealPricingContextPatch(input: {
  context: DealPricingContext;
  patch: UpdateDealPricingContextInput;
}): DealPricingContextSnapshot {
  const next = cloneDealPricingContext(input.context);

  if (input.patch.commercialDraft) {
    next.commercialDraft = DealPricingCommercialDraftSchema.parse({
      ...next.commercialDraft,
      ...input.patch.commercialDraft,
      fixedFeeAmount: normalizeOptionalDecimalString(
        input.patch.commercialDraft.fixedFeeAmount,
      ),
      quoteMarkupPercent: normalizeOptionalDecimalString(
        input.patch.commercialDraft.quoteMarkupPercent,
      ),
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

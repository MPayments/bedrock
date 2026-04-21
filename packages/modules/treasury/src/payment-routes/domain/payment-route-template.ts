import { Entity } from "@bedrock/shared/core/domain";

import type { PaymentRouteCalculation } from "../application/contracts/dto";
import {
  PaymentRouteDraftSchema,
  PaymentRouteVisualMetadataSchema,
  normalizePaymentRouteDraft,
  type PaymentRouteDraft,
  type PaymentRouteTemplateStatus,
  type PaymentRouteVisualMetadata,
} from "../application/contracts/zod";
import type { PaymentRouteTemplateRecord } from "../application/ports/payment-routes.repository";

function cloneDraft(draft: PaymentRouteDraft): PaymentRouteDraft {
  return PaymentRouteDraftSchema.parse(
    normalizePaymentRouteDraft(structuredClone(draft)),
  );
}

function cloneVisual(
  visual: PaymentRouteVisualMetadata,
): PaymentRouteVisualMetadata {
  return PaymentRouteVisualMetadataSchema.parse(structuredClone(visual));
}

function cloneCalculation(
  calculation: PaymentRouteCalculation | null,
): PaymentRouteCalculation | null {
  return calculation ? structuredClone(calculation) : null;
}

export class PaymentRouteTemplateAggregate extends Entity<string> {
  private constructor(private readonly snapshot: PaymentRouteTemplateRecord) {
    super({ id: snapshot.id, props: {} });
  }

  static create(input: {
    createdAt: Date;
    draft: PaymentRouteDraft;
    id: string;
    lastCalculation: PaymentRouteCalculation | null;
    maxMarginBps?: number | null;
    minMarginBps?: number | null;
    name: string;
    status?: PaymentRouteTemplateStatus;
    updatedAt: Date;
    visual: PaymentRouteVisualMetadata;
  }) {
    return new PaymentRouteTemplateAggregate({
      createdAt: input.createdAt,
      draft: cloneDraft(input.draft),
      id: input.id,
      lastCalculation: cloneCalculation(input.lastCalculation),
      maxMarginBps: input.maxMarginBps ?? null,
      minMarginBps: input.minMarginBps ?? null,
      name: input.name.trim(),
      snapshotPolicy: "clone_on_attach",
      status: input.status ?? "active",
      updatedAt: input.updatedAt,
      visual: cloneVisual(input.visual),
    });
  }

  static fromSnapshot(snapshot: PaymentRouteTemplateRecord) {
    return new PaymentRouteTemplateAggregate({
      ...snapshot,
      draft: cloneDraft(snapshot.draft),
      lastCalculation: cloneCalculation(snapshot.lastCalculation),
      visual: cloneVisual(snapshot.visual),
    });
  }

  update(input: {
    draft?: PaymentRouteDraft;
    lastCalculation?: PaymentRouteCalculation | null;
    maxMarginBps?: number | null;
    minMarginBps?: number | null;
    name?: string;
    updatedAt: Date;
    visual?: PaymentRouteVisualMetadata;
  }) {
    return new PaymentRouteTemplateAggregate({
      ...this.snapshot,
      draft:
        input.draft !== undefined ? cloneDraft(input.draft) : this.snapshot.draft,
      lastCalculation:
        input.lastCalculation !== undefined
          ? cloneCalculation(input.lastCalculation)
          : this.snapshot.lastCalculation,
      maxMarginBps:
        input.maxMarginBps !== undefined
          ? input.maxMarginBps
          : this.snapshot.maxMarginBps,
      minMarginBps:
        input.minMarginBps !== undefined
          ? input.minMarginBps
          : this.snapshot.minMarginBps,
      name: input.name?.trim() || this.snapshot.name,
      updatedAt: input.updatedAt,
      visual:
        input.visual !== undefined
          ? cloneVisual(input.visual)
          : this.snapshot.visual,
    });
  }

  archive(updatedAt: Date) {
    return new PaymentRouteTemplateAggregate({
      ...this.snapshot,
      status: "archived",
      updatedAt,
    });
  }

  duplicate(input: { id: string; name: string; now: Date }) {
    return PaymentRouteTemplateAggregate.create({
      createdAt: input.now,
      draft: this.snapshot.draft,
      id: input.id,
      lastCalculation: this.snapshot.lastCalculation,
      maxMarginBps: this.snapshot.maxMarginBps,
      minMarginBps: this.snapshot.minMarginBps,
      name: input.name,
      updatedAt: input.now,
      visual: this.snapshot.visual,
    });
  }

  toSnapshot(): PaymentRouteTemplateRecord {
    return {
      ...this.snapshot,
      draft: cloneDraft(this.snapshot.draft),
      lastCalculation: cloneCalculation(this.snapshot.lastCalculation),
      visual: cloneVisual(this.snapshot.visual),
    };
  }
}

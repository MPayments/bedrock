import { stableStringify } from "@bedrock/shared/core/canon";
import { AggregateRoot, DomainError, invariant } from "@bedrock/shared/core/domain";

import type { QuotePricingPlanSnapshot } from "./quote-pricing-plan";
import type {
  QuotePricingMode,
  QuoteStatus,
} from "./quote-types";

export interface QuoteSnapshot {
  id: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  pricingMode: QuotePricingMode;
  pricingTrace: Record<string, unknown> | null;
  dealDirection: string | null;
  dealForm: string | null;
  rateNum: bigint;
  rateDen: bigint;
  status: QuoteStatus;
  usedByRef: string | null;
  usedAt: Date | null;
  expiresAt: Date;
  idempotencyKey: string;
  createdAt: Date;
}

export class Quote extends AggregateRoot<string> {
  private constructor(private readonly snapshot: QuoteSnapshot) {
    super({ id: snapshot.id, props: {} });
  }

  static create(input: {
    id: string;
    idempotencyKey: string;
    fromCurrencyId: string;
    toCurrencyId: string;
    createdAt: Date;
    pricingPlan: QuotePricingPlanSnapshot;
  }): Quote {
    invariant(input.id.trim().length > 0, "Quote id is required", {
      code: "treasury.quote.id_required",
    });
    invariant(
      input.idempotencyKey.trim().length > 0,
      "Quote idempotencyKey is required",
      {
        code: "treasury.quote.idempotency_required",
      },
    );

    return new Quote({
      id: input.id,
      fromCurrencyId: input.fromCurrencyId,
      toCurrencyId: input.toCurrencyId,
      fromAmountMinor: input.pricingPlan.fromAmountMinor,
      toAmountMinor: input.pricingPlan.toAmountMinor,
      pricingMode: input.pricingPlan.pricingMode,
      pricingTrace: input.pricingPlan.pricingTrace,
      dealDirection: input.pricingPlan.dealDirection,
      dealForm: input.pricingPlan.dealForm,
      rateNum: input.pricingPlan.rateNum,
      rateDen: input.pricingPlan.rateDen,
      status: "active",
      usedByRef: null,
      usedAt: null,
      expiresAt: input.pricingPlan.expiresAt,
      idempotencyKey: input.idempotencyKey,
      createdAt: input.createdAt,
    });
  }

  static fromSnapshot(snapshot: QuoteSnapshot): Quote {
    return new Quote({ ...snapshot });
  }

  expire(now: Date): { kind: "noop" } | { kind: "expire"; quote: Quote } {
    if (this.snapshot.status !== "active") {
      return { kind: "noop" };
    }

    if (this.snapshot.expiresAt.getTime() > now.getTime()) {
      return { kind: "noop" };
    }

    return {
      kind: "expire",
      quote: new Quote({
        ...this.snapshot,
        status: "expired",
      }),
    };
  }

  markUsed(input: {
    usedByRef: string;
    at: Date;
  }): { kind: "noop" } | { kind: "mark-used"; quote: Quote } {
    if (this.snapshot.status !== "active") {
      return { kind: "noop" };
    }

    if (this.snapshot.expiresAt.getTime() < input.at.getTime()) {
      throw new DomainError("quote expired", {
        code: "treasury.quote.expired",
        meta: { quoteId: this.snapshot.id },
      });
    }

    return {
      kind: "mark-used",
      quote: new Quote({
        ...this.snapshot,
        status: "used",
        usedByRef: input.usedByRef,
        usedAt: input.at,
      }),
    };
  }

  sameRequestAs(input: {
    idempotencyKey: string;
    pricingPlan: QuotePricingPlanSnapshot;
  }): boolean {
    return (
      this.snapshot.idempotencyKey === input.idempotencyKey &&
      this.snapshot.fromAmountMinor === input.pricingPlan.fromAmountMinor &&
      this.snapshot.toAmountMinor === input.pricingPlan.toAmountMinor &&
      this.snapshot.pricingMode === input.pricingPlan.pricingMode &&
      this.snapshot.dealDirection === input.pricingPlan.dealDirection &&
      this.snapshot.dealForm === input.pricingPlan.dealForm &&
      this.snapshot.rateNum === input.pricingPlan.rateNum &&
      this.snapshot.rateDen === input.pricingPlan.rateDen &&
      this.snapshot.expiresAt.getTime() ===
        input.pricingPlan.expiresAt.getTime() &&
      stableStringify(this.snapshot.pricingTrace ?? {}) ===
        stableStringify(input.pricingPlan.pricingTrace)
    );
  }

  toSnapshot(): QuoteSnapshot {
    return { ...this.snapshot };
  }
}

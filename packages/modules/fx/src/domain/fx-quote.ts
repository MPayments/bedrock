import { AggregateRoot, DomainError } from "@bedrock/shared/core/domain";

import type {
  FxQuotePricingMode,
  FxQuoteStatus,
} from "./quote-types";

export interface FxQuoteSnapshot {
  id: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  pricingMode: FxQuotePricingMode;
  pricingTrace: Record<string, unknown> | null;
  dealDirection: string | null;
  dealForm: string | null;
  rateNum: bigint;
  rateDen: bigint;
  status: FxQuoteStatus;
  usedByRef: string | null;
  usedAt: Date | null;
  expiresAt: Date;
  idempotencyKey: string;
  createdAt: Date;
}

export class FxQuote extends AggregateRoot<string> {
  private constructor(private readonly snapshot: FxQuoteSnapshot) {
    super({ id: snapshot.id, props: {} });
  }

  static fromSnapshot(snapshot: FxQuoteSnapshot): FxQuote {
    return new FxQuote({ ...snapshot });
  }

  markUsed(input: {
    usedByRef: string;
    at: Date;
  }): { kind: "noop" } | { kind: "mark-used"; quote: FxQuote } {
    if (this.snapshot.status !== "active") {
      return { kind: "noop" };
    }

    if (this.snapshot.expiresAt.getTime() < input.at.getTime()) {
      throw new DomainError("quote expired", {
        code: "fx.quote.expired",
        meta: { quoteId: this.snapshot.id },
      });
    }

    return {
      kind: "mark-used",
      quote: new FxQuote({
        ...this.snapshot,
        status: "used",
        usedByRef: input.usedByRef,
        usedAt: input.at,
      }),
    };
  }

  toSnapshot(): FxQuoteSnapshot {
    return { ...this.snapshot };
  }
}

import { ValueObject, invariant } from "@bedrock/shared/core/domain";
import { mulDivCeil, mulDivFloor } from "@bedrock/shared/money/math";

import type { QuoteLegSourceKind } from "./quote-types";

export interface QuoteLegSnapshot {
  idx: number;
  fromCurrency: string;
  toCurrency: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  rateNum: bigint;
  rateDen: bigint;
  sourceKind: QuoteLegSourceKind;
  sourceRef: string | null;
  asOf: Date;
  executionCounterpartyId: string | null;
}

export interface CreateQuoteLegInput {
  idx: number;
  fromCurrency: string;
  toCurrency: string;
  fromAmountMinor: bigint;
  rateNum: bigint;
  rateDen: bigint;
  sourceKind: QuoteLegSourceKind;
  sourceRef?: string | null;
  asOf: Date;
  executionCounterpartyId?: string | null;
}

function normalizeCurrency(currency: string, field: string): string {
  const normalized = currency.trim().toUpperCase();
  invariant(normalized.length > 0, `${field} is required`, {
    code: "treasury.quote_leg.currency_required",
    meta: { field },
  });
  return normalized;
}

function normalizeSnapshot(snapshot: QuoteLegSnapshot): QuoteLegSnapshot {
  const fromCurrency = normalizeCurrency(snapshot.fromCurrency, "fromCurrency");
  const toCurrency = normalizeCurrency(snapshot.toCurrency, "toCurrency");

  invariant(snapshot.idx > 0, "Quote leg idx must be positive", {
    code: "treasury.quote_leg.idx_invalid",
    meta: { idx: snapshot.idx },
  });
  invariant(snapshot.fromAmountMinor > 0n, "Quote leg amount must be positive", {
    code: "treasury.quote_leg.amount_invalid",
    meta: { idx: snapshot.idx, amount: snapshot.fromAmountMinor.toString() },
  });
  invariant(snapshot.rateNum > 0n, "Quote leg rate numerator must be positive", {
    code: "treasury.quote_leg.rate_num_invalid",
    meta: { idx: snapshot.idx, rateNum: snapshot.rateNum.toString() },
  });
  invariant(snapshot.rateDen > 0n, "Quote leg rate denominator must be positive", {
    code: "treasury.quote_leg.rate_den_invalid",
    meta: { idx: snapshot.idx, rateDen: snapshot.rateDen.toString() },
  });
  invariant(snapshot.toAmountMinor > 0n, "Quote leg output amount must be positive", {
    code: "treasury.quote_leg.output_amount_invalid",
    meta: { idx: snapshot.idx, amount: snapshot.toAmountMinor.toString() },
  });

  return {
    ...snapshot,
    fromCurrency,
    toCurrency,
    sourceRef: snapshot.sourceRef?.trim() || null,
    executionCounterpartyId: snapshot.executionCounterpartyId ?? null,
  };
}

export class QuoteLeg extends ValueObject<QuoteLegSnapshot> {
  private constructor(snapshot: QuoteLegSnapshot) {
    super(normalizeSnapshot(snapshot));
  }

  static create(input: CreateQuoteLegInput): QuoteLeg {
    const toAmountMinor = mulDivFloor(
      input.fromAmountMinor,
      input.rateNum,
      input.rateDen,
    );

    return new QuoteLeg({
      idx: input.idx,
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      fromAmountMinor: input.fromAmountMinor,
      toAmountMinor,
      rateNum: input.rateNum,
      rateDen: input.rateDen,
      sourceKind: input.sourceKind,
      sourceRef: input.sourceRef ?? null,
      asOf: input.asOf,
      executionCounterpartyId: input.executionCounterpartyId ?? null,
    });
  }

  static createFromTarget(input: Omit<CreateQuoteLegInput, "fromAmountMinor"> & {
    toAmountMinor: bigint;
  }): QuoteLeg {
    const fromAmountMinor = mulDivCeil(
      input.toAmountMinor,
      input.rateDen,
      input.rateNum,
    );

    return QuoteLeg.create({
      ...input,
      fromAmountMinor,
    });
  }

  static fromSnapshot(snapshot: QuoteLegSnapshot): QuoteLeg {
    return new QuoteLeg(snapshot);
  }

  get fromAmountMinor(): bigint {
    return this.props.fromAmountMinor;
  }

  get fromCurrency(): string {
    return this.props.fromCurrency;
  }

  get toCurrency(): string {
    return this.props.toCurrency;
  }

  get toAmountMinor(): bigint {
    return this.props.toAmountMinor;
  }

  toSnapshot(): QuoteLegSnapshot {
    return { ...this.props };
  }
}

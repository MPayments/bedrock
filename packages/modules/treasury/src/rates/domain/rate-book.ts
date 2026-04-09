import { invariant } from "@bedrock/shared/core/domain";

import type { RateSource } from "./rate-source";

export interface RateObservation {
  source: string;
  rateNum: bigint;
  rateDen: bigint;
  asOf: Date;
}

const USDT_ORDER: RateSource[] = ["grinex", "cbr", "xe", "investing"];
const RUB_ORDER: RateSource[] = ["cbr", "xe", "investing"];
const USD_ORDER: RateSource[] = ["xe", "cbr", "investing"];
const DEFAULT_ORDER: RateSource[] = ["investing", "cbr", "xe"];

export class RateBook {
  private readonly sourceOrder: RateSource[];
  private readonly manualRate: RateObservation | null;
  private readonly ratesBySource: Map<RateSource, RateObservation>;

  private constructor(input: {
    sourceOrder: RateSource[];
    manualRate?: RateObservation | null;
    ratesBySource?: Map<RateSource, RateObservation>;
  }) {
    this.sourceOrder = input.sourceOrder;
    this.manualRate = input.manualRate ?? null;
    this.ratesBySource = input.ratesBySource ?? new Map();
  }

  static forPair(base: string, quote: string): RateBook {
    const normalizedBase = base.trim().toUpperCase();
    const normalizedQuote = quote.trim().toUpperCase();

    invariant(normalizedBase.length > 0, "Rate base is required", {
      code: "treasury.rate.base_required",
    });
    invariant(normalizedQuote.length > 0, "Rate quote is required", {
      code: "treasury.rate.quote_required",
    });

    return new RateBook({
      sourceOrder: resolveSourceOrder(normalizedBase, normalizedQuote),
    });
  }

  preferredSources(): RateSource[] {
    return [...this.sourceOrder];
  }

  withManualRate(rate: RateObservation | null): RateBook {
    return new RateBook({
      sourceOrder: this.sourceOrder,
      manualRate: rate,
      ratesBySource: new Map(this.ratesBySource),
    });
  }

  withSourceRate(source: RateSource, rate: RateObservation): RateBook {
    const ratesBySource = new Map(this.ratesBySource);
    ratesBySource.set(source, rate);
    return new RateBook({
      sourceOrder: this.sourceOrder,
      manualRate: this.manualRate,
      ratesBySource,
    });
  }

  selectLatest(): RateObservation | null {
    if (this.manualRate) {
      return this.manualRate;
    }

    for (const source of this.sourceOrder) {
      const rate = this.ratesBySource.get(source);
      if (rate) {
        return rate;
      }
    }

    return null;
  }
}

function resolveSourceOrder(base: string, quote: string): RateSource[] {
  if (base === "USDT" || quote === "USDT") {
    return [...USDT_ORDER];
  }

  if (base === "RUB" || quote === "RUB") {
    return [...RUB_ORDER];
  }

  if (base === "USD" || quote === "USD") {
    return [...USD_ORDER];
  }

  return [...DEFAULT_ORDER];
}

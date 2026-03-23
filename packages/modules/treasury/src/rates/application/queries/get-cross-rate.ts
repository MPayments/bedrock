import { normalizeCurrency } from "@bedrock/currencies/contracts";

import { RateNotFoundError } from "../../../errors";
import { CrossRateResolver } from "../../domain/cross-rate-resolver";
import type { RateRowRecord } from "../ports/rates.repository";

export class GetCrossRateQuery {
  private readonly resolver = new CrossRateResolver();

  constructor(
    private readonly getLatestRate: (
      base: string,
      quote: string,
      asOf: Date,
    ) => Promise<RateRowRecord>,
  ) {}

  async execute(base: string, quote: string, asOf: Date, anchor = "USD") {
    const normalizedBase = normalizeCurrency(base);
    const normalizedQuote = normalizeCurrency(quote);
    const normalizedAnchor = normalizeCurrency(anchor);

    if (normalizedBase === normalizedQuote) {
      return this.resolver.resolve({
        base: normalizedBase,
        quote: normalizedQuote,
        anchor: normalizedAnchor,
      });
    }

    const direct = await this.lookupRate(normalizedBase, normalizedQuote, asOf);
    const inverse = direct
      ? null
      : await this.lookupRate(normalizedQuote, normalizedBase, asOf);
    const toAnchor =
      direct || inverse
        ? null
        : await this.lookupRateWithInverseFallback(
            normalizedBase,
            normalizedAnchor,
            asOf,
          );
    const fromAnchor =
      direct || inverse
        ? null
        : await this.lookupRateWithInverseFallback(
            normalizedAnchor,
            normalizedQuote,
            asOf,
          );

    return this.resolver.resolve({
      base: normalizedBase,
      quote: normalizedQuote,
      anchor: normalizedAnchor,
      direct,
      inverse,
      toAnchor,
      fromAnchor,
    });
  }

  private async lookupRate(base: string, quote: string, asOf: Date) {
    try {
      return await this.getLatestRate(base, quote, asOf);
    } catch (error) {
      if (error instanceof RateNotFoundError) {
        return null;
      }

      throw error;
    }
  }

  private async lookupRateWithInverseFallback(
    base: string,
    quote: string,
    asOf: Date,
  ) {
    const direct = await this.lookupRate(base, quote, asOf);
    if (direct) {
      return direct;
    }

    const inverse = await this.lookupRate(quote, base, asOf);
    if (!inverse) {
      return null;
    }

    return {
      source: inverse.source,
      rateNum: inverse.rateDen,
      rateDen: inverse.rateNum,
      asOf: inverse.asOf,
    };
  }
}

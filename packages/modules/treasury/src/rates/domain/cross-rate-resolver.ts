import type { RateObservation } from "./rate-book";
import { RateNotFoundError } from "../../errors";
import type { CrossRate } from "../application/ports/rates.repository";

export class CrossRateResolver {
  resolve(input: {
    base: string;
    quote: string;
    anchor: string;
    direct?: RateObservation | null;
    inverse?: RateObservation | null;
    toAnchor?: RateObservation | null;
    fromAnchor?: RateObservation | null;
  }): CrossRate {
    const normalizedBase = input.base.trim().toUpperCase();
    const normalizedQuote = input.quote.trim().toUpperCase();
    const normalizedAnchor = input.anchor.trim().toUpperCase();

    if (normalizedBase === normalizedQuote) {
      return {
        base: normalizedBase,
        quote: normalizedQuote,
        rateNum: 1n,
        rateDen: 1n,
        source: null,
      };
    }

    if (input.direct) {
      return {
        base: normalizedBase,
        quote: normalizedQuote,
        rateNum: input.direct.rateNum,
        rateDen: input.direct.rateDen,
        source: input.direct.source,
      };
    }

    if (input.inverse) {
      return {
        base: normalizedBase,
        quote: normalizedQuote,
        rateNum: input.inverse.rateDen,
        rateDen: input.inverse.rateNum,
        source: input.inverse.source,
      };
    }

    if (normalizedBase === normalizedAnchor || normalizedQuote === normalizedAnchor) {
      throw new RateNotFoundError(
        `No direct/inverse rate for ${normalizedBase}/${normalizedQuote} and anchor path not possible`,
      );
    }

    if (!input.toAnchor || !input.fromAnchor) {
      throw new RateNotFoundError(
        `No cross rate path for ${normalizedBase}/${normalizedQuote} via ${normalizedAnchor}`,
      );
    }

    return {
      base: normalizedBase,
      quote: normalizedQuote,
      rateNum: input.toAnchor.rateNum * input.fromAnchor.rateNum,
      rateDen: input.toAnchor.rateDen * input.fromAnchor.rateDen,
      source: input.toAnchor.source,
    };
  }
}

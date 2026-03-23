import type { CrossRate } from "../../../rates/application/ports";

export interface QuoteRatesPort {
  getCrossRate(
    base: string,
    quote: string,
    asOf: Date,
    anchor?: string,
  ): Promise<CrossRate>;
}

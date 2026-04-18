export interface RouteTemplateCurrencyRecord {
  code: string;
  id: string;
}

export interface RouteTemplateCurrenciesPort {
  findById(id: string): Promise<RouteTemplateCurrencyRecord>;
}

export interface RouteTemplateCrossRate {
  base: string;
  quote: string;
  rateDen: bigint;
  rateNum: bigint;
}

export type RouteTemplateCrossRateLookup = (
  base: string,
  quote: string,
  asOf: Date,
  anchor?: string,
) => Promise<RouteTemplateCrossRate>;

export interface CalculationFxQuoteReference {
  fromCurrencyId: string;
  id: string;
  rateDen: bigint;
  rateNum: bigint;
  toCurrencyId: string;
}

export interface CalculationCurrencyReference {
  code: string;
  id: string;
}

export interface CalculationReferencesPort {
  assertCurrencyExists(id: string): Promise<void>;
  findCurrencyByCode(code: string): Promise<CalculationCurrencyReference>;
  findFxQuoteById(id: string): Promise<CalculationFxQuoteReference | null>;
}

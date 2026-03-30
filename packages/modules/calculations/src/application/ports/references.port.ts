export interface CalculationFxQuoteReference {
  fromCurrencyId: string;
  id: string;
  rateDen: bigint;
  rateNum: bigint;
  toCurrencyId: string;
}

export interface CalculationReferencesPort {
  assertCurrencyExists(id: string): Promise<void>;
  findFxQuoteById(id: string): Promise<CalculationFxQuoteReference | null>;
}

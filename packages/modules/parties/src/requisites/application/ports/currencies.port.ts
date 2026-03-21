export interface RequisitesCurrenciesPort {
  assertCurrencyExists(id: string): Promise<void>;
  listCodesById(ids: string[]): Promise<Map<string, string>>;
}

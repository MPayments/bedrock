export interface FeesCurrencyRecord {
  id: string;
  code: string;
}

export interface FeesCurrenciesPort {
  findByCode(code: string): Promise<FeesCurrencyRecord>;
  findById(id: string): Promise<FeesCurrencyRecord>;
}

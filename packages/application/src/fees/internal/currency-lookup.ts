export interface FeesCurrencyRecord {
  id: string;
  code: string;
}

export interface FeesCurrencyLookup {
  findByCode(code: string): Promise<FeesCurrencyRecord>;
  findById(id: string): Promise<FeesCurrencyRecord>;
}

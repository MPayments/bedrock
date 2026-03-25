import type { CompanyLookupResult } from "../contracts/company-lookup-dto";

export interface CompanyLookupPort {
  searchByInn(inn: string): Promise<CompanyLookupResult | null>;
}

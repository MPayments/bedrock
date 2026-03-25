import type { CompanyLookupPort } from "../ports/company-lookup.port";

export class SearchCompanyQuery {
  constructor(private readonly companyLookup: CompanyLookupPort) {}

  async execute(inn: string) {
    return this.companyLookup.searchByInn(inn);
  }
}

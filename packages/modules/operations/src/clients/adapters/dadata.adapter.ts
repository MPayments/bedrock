import type { CompanyLookupResult } from "../application/contracts/company-lookup-dto";
import type { CompanyLookupPort } from "../application/ports/company-lookup.port";

// DaData API response types

interface DadataManagement {
  name: string;
  post: string;
}

interface DadataOpf {
  short: string;
}

interface DadataName {
  full_with_opf: string;
  short_with_opf: string;
  full: string;
  short: string;
}

interface DadataAddressData {
  oktmo: string;
}

interface DadataAddress {
  value: string;
  unrestricted_value: string;
  data: DadataAddressData;
}

interface DadataCompanyData {
  kpp: string;
  management: DadataManagement | null;
  opf: DadataOpf;
  name: DadataName;
  inn: string;
  ogrn: string;
  okpo: string | null;
  oktmo: string | null;
  address: DadataAddress;
}

interface DadataSuggestion {
  value: string;
  data: DadataCompanyData;
}

interface DadataPayload {
  suggestions: DadataSuggestion[];
}

interface DadataResponse {
  resultCode: string;
  payload: DadataPayload;
}

export interface DadataAdapterConfig {
  apiUrl: string;
}

const DEFAULT_CONFIG: DadataAdapterConfig = {
  apiUrl: "https://dadata.tbank.ru",
};

const INN_PATTERN = /^\d{10}$|^\d{12}$/;

export class DadataAdapter implements CompanyLookupPort {
  private readonly apiUrl: string;

  constructor(config: Partial<DadataAdapterConfig> = {}) {
    this.apiUrl = config.apiUrl ?? DEFAULT_CONFIG.apiUrl;
  }

  async searchByInn(inn: string): Promise<CompanyLookupResult | null> {
    if (!INN_PATTERN.test(inn)) {
      throw new Error("INN must be exactly 10 or 12 digits");
    }

    const url = `${this.apiUrl}/api/v1/party`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        count: 1,
        query: inn,
        branch_type: "MAIN",
      }),
    });

    if (!response.ok) {
      throw new Error(`DaData API error: ${response.status} ${response.statusText}`);
    }

    const data: DadataResponse = await response.json();

    if (data.resultCode !== "OK" || !data.payload?.suggestions?.length) {
      return null;
    }

    const suggestion = data.payload.suggestions[0]!;
    const company = suggestion.data;

    return {
      inn: company.inn,
      kpp: company.kpp || null,
      ogrn: company.ogrn || null,
      name: company.name?.short_with_opf || suggestion.value,
      fullName: company.name?.full_with_opf || null,
      directorName: company.management?.name || null,
      directorPosition: company.management?.post || null,
      address: company.address?.unrestricted_value || company.address?.value || null,
      oktmo: company.address?.data?.oktmo || company.oktmo || null,
      okpo: company.okpo || null,
      orgType: company.opf?.short || null,
    };
  }
}

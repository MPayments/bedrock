import { API_BASE_URL } from "@/lib/constants";

export interface PortalCounterpartyContext {
  externalRef: string | null;
  fullName: string;
  id: string;
  kind: "individual" | "legal_entity";
  partyProfile: {
    contacts: {
      isPrimary: boolean;
      type: string;
      value: string;
    }[];
    identifiers: {
      scheme: string;
      value: string;
    }[];
  } | null;
  relationshipKind: "customer_owned" | "external";
  shortName: string;
}

export interface PortalCustomerContext {
  agentAgreement: {
    contractNumber: string | null;
    status: "active" | "missing";
  };
  customer: {
    description: string | null;
    name: string;
    externalRef: string | null;
    id: string;
  };
  counterparties: PortalCounterpartyContext[];
}

export interface PortalCustomerContextsResponse {
  data: PortalCustomerContext[];
  total: number;
}

export async function requestPortalCustomers() {
  const response = await fetch(`${API_BASE_URL}/portal/customers`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Ошибка загрузки субъектов: ${response.status}`);
  }

  return (await response.json()) as PortalCustomerContextsResponse;
}

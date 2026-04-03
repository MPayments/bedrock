import { API_BASE_URL } from "@/lib/constants";

export interface PortalLegalEntityContext {
  counterpartyId: string;
  inn: string | null;
  phone: string | null;
  relationshipKind: "customer_owned" | "external";
  shortName: string;
}

export interface PortalCustomerContext {
  agentAgreement: {
    contractNumber: string | null;
    status: "active" | "missing";
  };
  customerId: string;
  description: string | null;
  displayName: string;
  externalRef: string | null;
  legalEntities: PortalLegalEntityContext[];
  legalEntityCount: number;
  primaryCounterpartyId: string | null;
}

export interface PortalCustomerContextsResponse {
  data: PortalCustomerContext[];
  total: number;
}

export function hasActiveAgentAgreement(customer: PortalCustomerContext) {
  return customer.agentAgreement.status === "active";
}

export async function requestCustomerContexts() {
  const response = await fetch(`${API_BASE_URL}/customer/contexts`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Ошибка загрузки организаций: ${response.status}`);
  }

  return (await response.json()) as PortalCustomerContextsResponse;
}

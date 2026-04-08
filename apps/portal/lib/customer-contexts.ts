import { API_BASE_URL } from "@/lib/constants";

export interface PortalLegalEntityContext {
  externalId: string | null;
  fullName: string;
  id: string;
  legalEntity: {
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
    displayName: string;
    externalRef: string | null;
    id: string;
  };
  legalEntities: PortalLegalEntityContext[];
}

export interface PortalCustomerContextsResponse {
  data: PortalCustomerContext[];
  total: number;
}

export function hasActiveAgentAgreement(customer: PortalCustomerContext) {
  return customer.agentAgreement.status === "active";
}

function pickPrimary<T extends { isPrimary: boolean }>(items: T[]) {
  return items.find((item) => item.isPrimary) ?? items[0] ?? null;
}

export function resolvePortalCustomerId(customer: PortalCustomerContext) {
  return customer.customer.id;
}

export function resolvePortalCustomerDisplayName(
  customer: PortalCustomerContext,
) {
  return customer.customer.displayName;
}

export function resolvePortalCustomerDescription(
  customer: PortalCustomerContext,
) {
  return customer.customer.description;
}

export function resolvePortalCustomerExternalRef(
  customer: PortalCustomerContext,
) {
  return customer.customer.externalRef;
}

export function resolvePortalPrimaryCounterpartyId(
  customer: PortalCustomerContext,
) {
  return customer.legalEntities[0]?.id ?? null;
}

export function resolvePortalLegalEntityInn(
  legalEntity: PortalLegalEntityContext,
) {
  return (
    legalEntity.legalEntity?.identifiers.find(
      (identifier) => identifier.scheme === "inn",
    )?.value ??
    legalEntity.externalId ??
    null
  );
}

export function resolvePortalLegalEntityPhone(
  legalEntity: PortalLegalEntityContext,
) {
  return (
    pickPrimary(
      (legalEntity.legalEntity?.contacts ?? []).filter(
        (contact) => contact.type === "phone",
      ),
    )?.value ?? null
  );
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

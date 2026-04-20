import { z } from "zod";

export type SubAgent = {
  commissionRate: number;
  counterpartyId: string;
  country: string | null;
  fullName: string;
  isActive: boolean;
  kind: "individual" | "legal_entity";
  shortName: string;
};

export type CustomerCounterparty = {
  counterpartyId: string;
  country: string | null;
  createdAt: string;
  externalRef: string | null;
  fullName: string;
  inn: string | null;
  kind: "individual" | "legal_entity";
  orgName: string;
  relationshipKind: "customer_owned" | "external";
  shortName: string;
  subAgent: SubAgent | null;
  subAgentCounterpartyId: string | null;
  updatedAt: string;
};

export type CustomerWorkspaceDetail = {
  createdAt: string;
  description: string | null;
  name: string;
  externalRef: string | null;
  hasActiveAgreement: boolean;
  id: string;
  counterparties: CustomerCounterparty[];
  counterpartyCount: number;
  primaryCounterpartyId: string | null;
  updatedAt: string;
};

export const CUSTOMER_DETAIL_TABS = [
  "common",
  "counterparties",
  "requisites",
  "documents",
  "agreements",
] as const;

export type CustomerDetailTab = (typeof CUSTOMER_DETAIL_TABS)[number];

export const ClientDocumentSchema = z.object({
  createdAt: z.iso.datetime(),
  description: z.string().nullable(),
  fileName: z.string(),
  fileSize: z.number(),
  id: z.union([z.number(), z.string()]),
  mimeType: z.string(),
  updatedAt: z.iso.datetime().optional().default(""),
  uploadedBy: z.string().nullable(),
});

export const ClientDocumentsSchema = z.array(ClientDocumentSchema);

export type ClientDocument = z.infer<typeof ClientDocumentSchema>;

export const customerFormSchema = z.object({
  description: z.string(),
  name: z.string().trim().min(1, "Название клиента обязательно"),
  externalRef: z.string(),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;

export function customerToFormValues(
  workspace: Pick<
    CustomerWorkspaceDetail,
    "description" | "name" | "externalRef"
  > | null,
): CustomerFormData {
  return {
    description: workspace?.description ?? "",
    name: workspace?.name ?? "",
    externalRef: workspace?.externalRef ?? "",
  };
}

export function isPrimaryCounterparty(
  workspace: Pick<
    CustomerWorkspaceDetail,
    "counterparties" | "primaryCounterpartyId"
  >,
  counterpartyId: string,
) {
  return (
    workspace.primaryCounterpartyId === counterpartyId ||
    (!workspace.primaryCounterpartyId &&
      workspace.counterparties[0]?.counterpartyId === counterpartyId)
  );
}

export function normalizeCustomerDetailTab(
  value: string | null | undefined,
): CustomerDetailTab {
  if (value && CUSTOMER_DETAIL_TABS.includes(value as CustomerDetailTab)) {
    return value as CustomerDetailTab;
  }

  return "common";
}

export function buildCustomerTabHref(input: {
  pathname: string;
  searchParams: URLSearchParams;
  tab: CustomerDetailTab;
}) {
  const nextSearchParams = new URLSearchParams(input.searchParams.toString());
  nextSearchParams.delete("entity");

  if (input.tab === "common") {
    nextSearchParams.delete("tab");
  } else {
    nextSearchParams.set("tab", input.tab);
  }

  const query = nextSearchParams.toString();
  return query.length > 0 ? `${input.pathname}?${query}` : input.pathname;
}

export function buildCustomerCounterpartiesTabHref(customerId: string) {
  return buildCustomerTabHref({
    pathname: `/customers/${customerId}`,
    searchParams: new URLSearchParams(),
    tab: "counterparties",
  });
}

export function buildCustomerCounterpartyCreateHref(customerId: string) {
  return `/customers/${customerId}/counterparties/new`;
}

export function buildCustomerCounterpartyDetailsHref(
  customerId: string,
  counterpartyId: string,
) {
  return `/customers/${customerId}/counterparties/${counterpartyId}`;
}

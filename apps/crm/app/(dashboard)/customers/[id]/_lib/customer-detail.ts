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

export type CustomerLegalEntity = {
  account: string | null;
  address: string | null;
  bankAddress: string | null;
  bankCountry: string | null;
  bankName: string | null;
  bankProviderId: string | null;
  bic: string | null;
  beneficiaryName: string | null;
  contractNumber: string | null;
  corrAccount: string | null;
  counterpartyId: string;
  country: string | null;
  createdAt: string;
  directorBasis: string | null;
  directorName: string | null;
  email: string | null;
  externalId: string | null;
  fullName: string;
  inn: string | null;
  iban: string | null;
  kpp: string | null;
  ogrn: string | null;
  okpo: string | null;
  oktmo: string | null;
  orgName: string;
  orgType: string | null;
  phone: string | null;
  position: string | null;
  relationshipKind: "customer_owned" | "external";
  shortName: string;
  subAgent: SubAgent | null;
  subAgentCounterpartyId: string | null;
  swift: string | null;
  updatedAt: string;
};

export type CustomerWorkspaceDetail = {
  createdAt: string;
  description: string | null;
  displayName: string;
  externalRef: string | null;
  hasActiveAgreement: boolean;
  id: string;
  legalEntities: CustomerLegalEntity[];
  legalEntityCount: number;
  primaryCounterpartyId: string | null;
  updatedAt: string;
};

export type ClientDocument = {
  createdAt: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  id: string;
  mimeType: string;
  updatedAt: string;
  uploadedBy: string | null;
};

export const customerFormSchema = z.object({
  description: z.string(),
  displayName: z.string().trim().min(1, "Название клиента обязательно"),
  externalRef: z.string(),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;

export const legalEntityFormSchema = z.object({
  address: z.string().optional(),
  directorBasis: z.string().optional(),
  directorName: z.string().optional(),
  email: z.string().optional(),
  inn: z.string().optional(),
  kpp: z.string().optional(),
  ogrn: z.string().optional(),
  okpo: z.string().optional(),
  oktmo: z.string().optional(),
  orgName: z.string().min(1, "Название юридического лица обязательно"),
  orgType: z.string().optional(),
  phone: z.string().optional(),
  position: z.string().optional(),
});

export type LegalEntityFormData = z.infer<typeof legalEntityFormSchema>;

export const createLegalEntitySchema = z.object({
  address: z.string().optional(),
  country: z.string().max(2).optional(),
  directorName: z.string().optional(),
  email: z.string().optional(),
  inn: z.string().optional(),
  orgName: z.string().min(1, "Название юридического лица обязательно"),
  phone: z.string().optional(),
});

export type CreateLegalEntityFormData = z.infer<typeof createLegalEntitySchema>;

export function customerToFormValues(
  workspace: CustomerWorkspaceDetail | null,
): CustomerFormData {
  return {
    description: workspace?.description ?? "",
    displayName: workspace?.displayName ?? "",
    externalRef: workspace?.externalRef ?? "",
  };
}

export function legalEntityToFormValues(
  legalEntity: CustomerLegalEntity | null,
): LegalEntityFormData {
  return {
    address: legalEntity?.address ?? "",
    directorBasis: legalEntity?.directorBasis ?? "",
    directorName: legalEntity?.directorName ?? "",
    email: legalEntity?.email ?? "",
    inn: legalEntity?.inn ?? "",
    kpp: legalEntity?.kpp ?? "",
    ogrn: legalEntity?.ogrn ?? "",
    okpo: legalEntity?.okpo ?? "",
    oktmo: legalEntity?.oktmo ?? "",
    orgName: legalEntity?.orgName ?? "",
    orgType: legalEntity?.orgType ?? "",
    phone: legalEntity?.phone ?? "",
    position: legalEntity?.position ?? "",
  };
}

export function isPrimaryLegalEntity(
  workspace: Pick<
    CustomerWorkspaceDetail,
    "legalEntities" | "primaryCounterpartyId"
  >,
  counterpartyId: string,
) {
  return (
    workspace.primaryCounterpartyId === counterpartyId ||
    (!workspace.primaryCounterpartyId &&
      workspace.legalEntities[0]?.counterpartyId === counterpartyId)
  );
}

export function resolveActiveLegalEntityId(input: {
  legalEntities: CustomerLegalEntity[];
  primaryCounterpartyId: string | null;
  requestedCounterpartyId: string | null;
}) {
  if (input.legalEntities.length === 0) {
    return null;
  }

  if (
    input.requestedCounterpartyId &&
    input.legalEntities.some(
      (legalEntity) =>
        legalEntity.counterpartyId === input.requestedCounterpartyId,
    )
  ) {
    return input.requestedCounterpartyId;
  }

  if (
    input.primaryCounterpartyId &&
    input.legalEntities.some(
      (legalEntity) =>
        legalEntity.counterpartyId === input.primaryCounterpartyId,
    )
  ) {
    return input.primaryCounterpartyId;
  }

  return input.legalEntities[0]?.counterpartyId ?? null;
}

export function buildCustomerEntityHref(input: {
  counterpartyId: string | null;
  pathname: string;
  searchParams: URLSearchParams;
}) {
  const nextSearchParams = new URLSearchParams(input.searchParams.toString());

  if (input.counterpartyId) {
    nextSearchParams.set("entity", input.counterpartyId);
  } else {
    nextSearchParams.delete("entity");
  }

  const query = nextSearchParams.toString();
  return query.length > 0 ? `${input.pathname}?${query}` : input.pathname;
}

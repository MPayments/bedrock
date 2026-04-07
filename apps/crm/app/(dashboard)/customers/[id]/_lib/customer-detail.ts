import { z } from "zod";

export const SubAgentSchema = z.object({
  commissionRate: z.number(),
  counterpartyId: z.string(),
  country: z.string().nullable(),
  fullName: z.string(),
  isActive: z.boolean(),
  kind: z.enum(["individual", "legal_entity"]),
  shortName: z.string(),
});

export type SubAgent = z.infer<typeof SubAgentSchema>;

export const CustomerLegalEntitySchema = z.object({
  account: z.string().nullable(),
  address: z.string().nullable(),
  bankAddress: z.string().nullable(),
  bankCountry: z.string().nullable(),
  bankName: z.string().nullable(),
  bankProviderId: z.string().nullable(),
  bic: z.string().nullable(),
  beneficiaryName: z.string().nullable(),
  contractNumber: z.string().nullable(),
  corrAccount: z.string().nullable(),
  counterpartyId: z.string(),
  country: z.string().nullable(),
  createdAt: z.iso.datetime(),
  directorBasis: z.string().nullable(),
  directorName: z.string().nullable(),
  email: z.string().nullable(),
  externalId: z.string().nullable(),
  fullName: z.string(),
  inn: z.string().nullable(),
  iban: z.string().nullable(),
  kpp: z.string().nullable(),
  ogrn: z.string().nullable(),
  okpo: z.string().nullable(),
  oktmo: z.string().nullable(),
  orgName: z.string(),
  orgType: z.string().nullable(),
  phone: z.string().nullable(),
  position: z.string().nullable(),
  relationshipKind: z.enum(["customer_owned", "external"]),
  shortName: z.string(),
  subAgent: SubAgentSchema.nullable(),
  subAgentCounterpartyId: z.string().nullable(),
  swift: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export type CustomerLegalEntity = z.infer<typeof CustomerLegalEntitySchema>;

export const CustomerWorkspaceDetailSchema = z.object({
  createdAt: z.iso.datetime(),
  description: z.string().nullable(),
  displayName: z.string(),
  externalRef: z.string().nullable(),
  hasActiveAgreement: z.boolean(),
  id: z.string(),
  legalEntities: z.array(CustomerLegalEntitySchema),
  legalEntityCount: z.number().int().nonnegative(),
  primaryCounterpartyId: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export type CustomerWorkspaceDetail = z.infer<
  typeof CustomerWorkspaceDetailSchema
>;

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

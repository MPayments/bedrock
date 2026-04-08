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
  counterpartyId: string;
  country: string | null;
  createdAt: string;
  externalId: string | null;
  fullName: string;
  inn: string | null;
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
  displayName: string;
  externalRef: string | null;
  hasActiveAgreement: boolean;
  id: string;
  legalEntities: CustomerLegalEntity[];
  legalEntityCount: number;
  primaryCounterpartyId: string | null;
  updatedAt: string;
};

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

export function customerToFormValues(
  workspace: Pick<
    CustomerWorkspaceDetail,
    "description" | "displayName" | "externalRef"
  > | null,
): CustomerFormData {
  return {
    description: workspace?.description ?? "",
    displayName: workspace?.displayName ?? "",
    externalRef: workspace?.externalRef ?? "",
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

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

export function resolveActiveCounterpartyId(input: {
  counterparties: CustomerCounterparty[];
  primaryCounterpartyId: string | null;
  requestedCounterpartyId: string | null;
}) {
  if (input.counterparties.length === 0) {
    return null;
  }

  if (
    input.requestedCounterpartyId &&
    input.counterparties.some(
      (partyProfile) =>
        partyProfile.counterpartyId === input.requestedCounterpartyId,
    )
  ) {
    return input.requestedCounterpartyId;
  }

  if (
    input.primaryCounterpartyId &&
    input.counterparties.some(
      (partyProfile) =>
        partyProfile.counterpartyId === input.primaryCounterpartyId,
    )
  ) {
    return input.primaryCounterpartyId;
  }

  return input.counterparties[0]?.counterpartyId ?? null;
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

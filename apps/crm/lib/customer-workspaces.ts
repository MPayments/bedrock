import { z } from "zod";

import { apiClient } from "@/lib/api-client";
import { readJsonWithSchema } from "@/lib/api/response";

export const CrmCustomerWorkspaceSubAgentSchema = z.object({
  commissionRate: z.number(),
  counterpartyId: z.uuid(),
  country: z.string().nullable(),
  fullName: z.string(),
  isActive: z.boolean(),
  kind: z.enum(["individual", "legal_entity"]),
  shortName: z.string(),
});

export type CrmCustomerWorkspaceSubAgent = z.infer<
  typeof CrmCustomerWorkspaceSubAgentSchema
>;

export const CrmCustomerWorkspaceCounterpartySchema = z.object({
  counterpartyId: z.uuid(),
  country: z.string().nullable(),
  createdAt: z.iso.datetime(),
  externalRef: z.string().nullable(),
  fullName: z.string(),
  inn: z.string().nullable(),
  orgName: z.string(),
  relationshipKind: z.enum(["customer_owned", "external"]),
  shortName: z.string(),
  subAgent: CrmCustomerWorkspaceSubAgentSchema.nullable(),
  subAgentCounterpartyId: z.uuid().nullable(),
  updatedAt: z.iso.datetime(),
});

export type CrmCustomerWorkspaceCounterparty = z.infer<
  typeof CrmCustomerWorkspaceCounterpartySchema
>;

export const CrmCustomerWorkspaceSchema = z.object({
  createdAt: z.iso.datetime(),
  description: z.string().nullable(),
  externalRef: z.string().nullable(),
  hasActiveAgreement: z.boolean(),
  id: z.uuid(),
  name: z.string(),
  counterparties: z.array(CrmCustomerWorkspaceCounterpartySchema),
  counterpartyCount: z.number().int().nonnegative(),
  primaryCounterpartyId: z.uuid().nullable(),
  updatedAt: z.iso.datetime(),
});

export type CrmCustomerWorkspace = z.infer<typeof CrmCustomerWorkspaceSchema>;

export interface CrmDealDraftCustomerContext {
  id: string;
  counterparties: {
    counterpartyId: string;
    fullName: string;
    inn: string | null;
    orgName: string;
    shortName: string;
  }[];
  primaryCounterpartyId: string | null;
}

export function buildDealDraftCustomerContext(
  workspace: CrmCustomerWorkspace,
): CrmDealDraftCustomerContext {
  return {
    id: workspace.id,
    counterparties: workspace.counterparties.map((counterparty) => ({
      counterpartyId: counterparty.counterpartyId,
      fullName: counterparty.fullName,
      inn: counterparty.inn,
      orgName: counterparty.orgName,
      shortName: counterparty.shortName,
    })),
    primaryCounterpartyId: workspace.primaryCounterpartyId,
  };
}

export async function requestCustomerWorkspace(customerId: string) {
  const response = await apiClient.v1.customers[":id"].workspace.$get({
    param: { id: customerId },
  });
  const status = response.status;

  if (!response.ok) {
    throw new Error(
      status === 404
        ? "Клиент не найден"
        : `Не удалось загрузить клиента: ${status}`,
    );
  }

  return readJsonWithSchema(response, CrmCustomerWorkspaceSchema);
}

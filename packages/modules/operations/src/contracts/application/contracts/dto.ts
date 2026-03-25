import { z } from "zod";

export const ContractSchema = z.object({
  id: z.number().int(),
  contractNumber: z.string().nullable(),
  contractDate: z.string().nullable(),
  agentFee: z.string().nullable(),
  fixedFee: z.string().nullable(),
  clientId: z.number().int(),
  agentOrganizationId: z.number().int(),
  agentOrganizationBankDetailsId: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Contract = z.infer<typeof ContractSchema>;

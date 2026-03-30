import { z } from "zod";

export const CreateContractInputSchema = z.object({
  clientId: z.number().int(),
  agentOrganizationId: z.number().int(),
  organizationRequisiteId: z.string().uuid(),
  contractNumber: z.string().optional(),
  contractDate: z.string().optional(),
  agentFee: z.string().optional(),
  fixedFee: z.string().optional(),
});

export type CreateContractInput = z.infer<typeof CreateContractInputSchema>;

export const UpdateContractInputSchema = z.object({
  id: z.number().int(),
  contractNumber: z.string().optional(),
  contractDate: z.string().optional(),
  agentFee: z.string().optional(),
  fixedFee: z.string().optional(),
  agentOrganizationId: z.number().int().optional(),
  organizationRequisiteId: z.string().uuid().optional(),
});

export type UpdateContractInput = z.infer<typeof UpdateContractInputSchema>;

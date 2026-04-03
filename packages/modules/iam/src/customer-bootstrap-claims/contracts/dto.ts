import { z } from "zod";

export const CustomerBootstrapClaimSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  normalizedInn: z.string(),
  normalizedKpp: z.string(),
  clientId: z.number().int().nullable(),
  customerId: z.uuid().nullable(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CustomerBootstrapClaim = z.infer<
  typeof CustomerBootstrapClaimSchema
>;

import { z } from "zod";

export const CustomerMembershipSchema = z.object({
  id: z.uuid(),
  customerId: z.uuid(),
  userId: z.string(),
  role: z.string(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CustomerMembership = z.infer<typeof CustomerMembershipSchema>;

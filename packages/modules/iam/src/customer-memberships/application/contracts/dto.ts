import { z } from "zod";

export const CustomerMembershipSchema = z.object({
  customerId: z.uuid(),
  userId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CustomerMembership = z.infer<typeof CustomerMembershipSchema>;

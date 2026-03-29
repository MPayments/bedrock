import { z } from "zod";

export const UpsertCustomerMembershipInputSchema = z.object({
  customerId: z.uuid(),
  userId: z.string().min(1),
});

export type UpsertCustomerMembershipInput = z.infer<
  typeof UpsertCustomerMembershipInputSchema
>;

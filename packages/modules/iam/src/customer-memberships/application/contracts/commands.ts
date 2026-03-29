import { z } from "zod";

export const UpsertCustomerMembershipInputSchema = z.object({
  customerId: z.uuid(),
  userId: z.string().min(1),
  role: z.string().min(1).default("owner"),
  status: z.string().min(1).default("active"),
});

export type UpsertCustomerMembershipInput = z.infer<
  typeof UpsertCustomerMembershipInputSchema
>;

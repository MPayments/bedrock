import { z } from "zod";

export const ListCustomerMembershipsByUserIdInputSchema = z.object({
  userId: z.string().min(1),
});

export type ListCustomerMembershipsByUserIdInput = z.infer<
  typeof ListCustomerMembershipsByUserIdInputSchema
>;

export const HasCustomerMembershipInputSchema = z.object({
  customerId: z.uuid(),
  userId: z.string().min(1),
});

export type HasCustomerMembershipInput = z.infer<
  typeof HasCustomerMembershipInputSchema
>;

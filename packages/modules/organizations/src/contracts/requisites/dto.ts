import { z } from "zod";

export const OrganizationRequisiteAccountingBindingSchema = z.object({
  requisiteId: z.uuid(),
  organizationId: z.uuid(),
  currencyCode: z.string(),
  bookId: z.uuid(),
  bookAccountInstanceId: z.uuid(),
  postingAccountNo: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type OrganizationRequisiteAccountingBinding = z.infer<
  typeof OrganizationRequisiteAccountingBindingSchema
>;

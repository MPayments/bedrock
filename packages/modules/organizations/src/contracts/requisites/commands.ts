import { z } from "zod";

export const UpsertOrganizationRequisiteAccountingBindingInputSchema = z.object(
  {
    postingAccountNo: z
      .string()
      .trim()
      .regex(/^[0-9]{4}$/),
  },
);

export type UpsertOrganizationRequisiteAccountingBindingInput = z.infer<
  typeof UpsertOrganizationRequisiteAccountingBindingInputSchema
>;

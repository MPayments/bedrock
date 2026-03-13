import { z } from "zod";

export const accountNoSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{4}$/, "accountNo must match NNNN");

export const correspondenceRuleSchema = z.object({
  postingCode: z.string().min(1).max(128),
  debitAccountNo: accountNoSchema,
  creditAccountNo: accountNoSchema,
  enabled: z.boolean().default(true),
});

export const replaceCorrespondenceRulesSchema = z.object({
  rules: z.array(correspondenceRuleSchema),
});

export type CorrespondenceRuleInput = z.infer<typeof correspondenceRuleSchema>;
export type ReplaceCorrespondenceRulesInput = z.infer<
  typeof replaceCorrespondenceRulesSchema
>;

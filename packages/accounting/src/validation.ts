import { z } from "zod";

const uuidSchema = z.uuid({ version: "v4" });

export const accountNoSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{2}(\.[0-9]{2})?$/, "accountNo must match NN or NN.NN");

export const correspondenceRuleSchema = z.object({
  postingCode: z.string().min(1).max(128),
  debitAccountNo: accountNoSchema,
  creditAccountNo: accountNoSchema,
  enabled: z.boolean().default(true),
});

export const replaceCorrespondenceRulesSchema = z.object({
  rules: z.array(correspondenceRuleSchema),
});

export const upsertOrgAccountOverrideSchema = z.object({
  enabled: z.boolean(),
  nameOverride: z.string().trim().min(1).max(255).optional().nullable(),
});

export const seedDefaultsSchema = z.object({
  orgId: uuidSchema,
});

export type CorrespondenceRuleInput = z.infer<typeof correspondenceRuleSchema>;
export type ReplaceCorrespondenceRulesInput = z.infer<typeof replaceCorrespondenceRulesSchema>;
export type UpsertOrgAccountOverrideInput = z.infer<typeof upsertOrgAccountOverrideSchema>;

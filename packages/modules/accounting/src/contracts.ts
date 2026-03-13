import { z } from "zod";

export {
  accountNoSchema,
  correspondenceRuleSchema,
  replaceCorrespondenceRulesSchema,
} from "./validation";

export type {
  ReplaceCorrespondenceRulesInput,
} from "./validation";

export const AccountingTemplateAccountSchema = z.object({
  accountNo: z.string(),
  name: z.string(),
  kind: z.string(),
  normalSide: z.string(),
  postingAllowed: z.boolean(),
  enabled: z.boolean(),
  parentAccountNo: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const AccountingCorrespondenceRuleSchema = z.object({
  id: z.uuid(),
  postingCode: z.string(),
  debitAccountNo: z.string(),
  creditAccountNo: z.string(),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

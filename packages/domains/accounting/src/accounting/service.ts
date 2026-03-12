import { defineService } from "@bedrock/core";
import {
  AccountingCorrespondenceRuleSchema,
  AccountingTemplateAccountSchema,
} from "@multihansa/accounting/contracts";
import { DbToken } from "@multihansa/common/bedrock";
import { z } from "zod";

import {
  listCorrespondenceRules,
  listTemplateAccounts,
  replaceCorrespondenceRules,
  validatePostingMatrix,
} from "./runtime-service";
import { replaceCorrespondenceRulesSchema } from "./validation";

const ValidatePostingMatrixResultSchema = z.object({
  ok: z.boolean(),
  errors: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      postingCode: z.string().optional(),
      accountNo: z.string().optional(),
    }),
  ),
});

export const accountingService = defineService("accounting", {
  deps: {
    db: DbToken,
  },
  ctx: ({ db }) => ({
    db,
  }),
  actions: ({ action }) => ({
    listTemplateAccounts: action({
      output: z.array(AccountingTemplateAccountSchema),
      handler: async ({ ctx }) => {
        const rows = await listTemplateAccounts(ctx.db);
        return rows.map((row) => ({
          accountNo: row.accountNo,
          name: row.name,
          kind: row.kind,
          normalSide: row.normalSide,
          postingAllowed: row.postingAllowed,
          enabled: row.enabled,
          parentAccountNo: row.parentAccountNo,
          createdAt: row.createdAt.toISOString(),
        }));
      },
    }),
    listCorrespondenceRules: action({
      output: z.array(AccountingCorrespondenceRuleSchema),
      handler: async ({ ctx }) => {
        const rows = await listCorrespondenceRules(ctx.db);
        return rows.map((row) => ({
          id: row.id,
          postingCode: row.postingCode,
          debitAccountNo: row.debitAccountNo,
          creditAccountNo: row.creditAccountNo,
          enabled: row.enabled,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }));
      },
    }),
    replaceCorrespondenceRules: action({
      input: replaceCorrespondenceRulesSchema,
      output: z.array(AccountingCorrespondenceRuleSchema),
      handler: async ({ ctx, input }) => {
        const rows = await replaceCorrespondenceRules(ctx.db, input);
        return rows.map((row) => ({
          id: row.id,
          postingCode: row.postingCode,
          debitAccountNo: row.debitAccountNo,
          creditAccountNo: row.creditAccountNo,
          enabled: row.enabled,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }));
      },
    }),
    validatePostingMatrix: action({
      output: ValidatePostingMatrixResultSchema,
      handler: async ({ ctx }) => validatePostingMatrix(ctx.db),
    }),
  }),
});

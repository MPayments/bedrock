import { defineService, type Logger as BedrockLogger } from "@bedrock/core";
import {
  AccountingCorrespondenceRuleSchema,
  AccountingTemplateAccountSchema,
} from "@multihansa/accounting/contracts";
import {
  DbToken,
  adaptBedrockLogger,
} from "@multihansa/common/bedrock";
import { z } from "zod";

import { replaceCorrespondenceRulesSchema } from "./validation";
import { createAccountingService as createAccountingRuntime } from "./runtime-service";
import { AccountingPackDefinitionToken } from "./tokens";

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

function getAccountingRuntime(ctx: {
  db: Parameters<typeof createAccountingRuntime>[0]["db"];
  defaultPackDefinition: Parameters<
    typeof createAccountingRuntime
  >[0]["defaultPackDefinition"];
  logger: BedrockLogger;
}) {
  return createAccountingRuntime({
    db: ctx.db,
    logger: adaptBedrockLogger(ctx.logger),
    defaultPackDefinition: ctx.defaultPackDefinition,
  });
}

export const accountingService = defineService("accounting", {
  deps: {
    db: DbToken,
    defaultPackDefinition: AccountingPackDefinitionToken,
  },
  ctx: ({ db, defaultPackDefinition }) => ({
    db,
    defaultPackDefinition,
  }),
  actions: ({ action }) => ({
    listTemplateAccounts: action({
      output: z.array(AccountingTemplateAccountSchema),
      handler: async ({ ctx }) => {
        const rows = await getAccountingRuntime(ctx).listTemplateAccounts();
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
        const rows = await getAccountingRuntime(ctx).listCorrespondenceRules();
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
        const rows = await getAccountingRuntime(ctx).replaceCorrespondenceRules(
          input,
        );
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
      handler: async ({ ctx }) => getAccountingRuntime(ctx).validatePostingMatrix(),
    }),
  }),
});

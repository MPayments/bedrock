import { defineController, http, type DefinedController } from "@bedrock/core";
import { AuthContextToken, requirePermissionMiddleware } from "@bedrock/security";
import {
  AccountingCorrespondenceRuleSchema,
  AccountingTemplateAccountSchema,
} from "@multihansa/accounting/contracts";
import { z } from "zod";

import { replaceCorrespondenceRulesSchema } from "./validation";
import { accountingService } from "./service";

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

export const accountingController: DefinedController = defineController("accounting-http", {
  basePath: "/v1/accounting",
  deps: {
    auth: AuthContextToken,
  },
  ctx: ({ auth }) => ({ auth }),
  routes: ({ route }) => ({
    listTemplateAccounts: route.get({
      path: "/template/accounts",
      responses: {
        200: z.array(AccountingTemplateAccountSchema),
      },
      middleware: [requirePermissionMiddleware("accounting:list")],
      handler: accountingService.actions.listTemplateAccounts,
    }),
    listCorrespondenceRules: route.get({
      path: "/correspondence-rules",
      responses: {
        200: z.array(AccountingCorrespondenceRuleSchema),
      },
      middleware: [requirePermissionMiddleware("accounting:list")],
      handler: accountingService.actions.listCorrespondenceRules,
    }),
    replaceCorrespondenceRules: route.put({
      path: "/correspondence-rules",
      request: {
        body: replaceCorrespondenceRulesSchema,
      },
      responses: {
        200: z.array(AccountingCorrespondenceRuleSchema),
      },
      middleware: [requirePermissionMiddleware("accounting:manage_correspondence")],
      handler: ({ call, request }) =>
        call(accountingService.actions.replaceCorrespondenceRules, request.body),
    }),
    validatePostingMatrix: route.post({
      path: "/correspondence-rules/validate",
      responses: {
        200: ValidatePostingMatrixResultSchema,
      },
      middleware: [requirePermissionMiddleware("accounting:manage_correspondence")],
      handler: ({ call }) => call(accountingService.actions.validatePostingMatrix),
    }),
  }),
});

import { createRoute, z } from "@hono/zod-openapi";

import { replaceCorrespondenceRulesSchema } from "@bedrock/accounting";
import { AccountingCorrespondenceRuleSchema } from "@bedrock/accounting/contracts";

import { ErrorSchema } from "../../common";
import type { AppContext } from "../../context";
import { requirePermission } from "../../middleware/permission";
import {
  createAccountingRouteApp,
  handleAccountingRouteError,
} from "./report-route-kit";

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

export function accountingCorrespondenceRoutes(ctx: AppContext) {
  const app = createAccountingRouteApp();

  const listRulesRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Accounting"],
    summary: "List global correspondence rules",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(AccountingCorrespondenceRuleSchema),
          },
        },
        description: "Rules",
      },
    },
  });

  const replaceRulesRoute = createRoute({
    middleware: [requirePermission({ accounting: ["manage_correspondence"] })],
    method: "put",
    path: "/",
    tags: ["Accounting"],
    summary: "Replace global correspondence rules",
    request: {
      body: {
        content: {
          "application/json": {
            schema: replaceCorrespondenceRulesSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(AccountingCorrespondenceRuleSchema),
          },
        },
        description: "Rules replaced",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
    },
  });

  const validatePostingMatrixRoute = createRoute({
    middleware: [requirePermission({ accounting: ["manage_correspondence"] })],
    method: "post",
    path: "/validate",
    tags: ["Accounting"],
    summary: "Validate posting matrix and account analytics consistency",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ValidatePostingMatrixResultSchema,
          },
        },
        description: "Validation result",
      },
    },
  });

  return app
    .openapi(listRulesRoute, async (c) => {
      const rows = await ctx.accountingService.listCorrespondenceRules();
      return c.json(
        rows.map((row: (typeof rows)[number]) => ({
          id: row.id,
          postingCode: row.postingCode,
          debitAccountNo: row.debitAccountNo,
          creditAccountNo: row.creditAccountNo,
          enabled: row.enabled,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
        200,
      );
    })
    .openapi(replaceRulesRoute, async (c) => {
      try {
        const body = c.req.valid("json");
        const rows =
          await ctx.accountingService.replaceCorrespondenceRules(body);
        return c.json(
          rows.map((row: (typeof rows)[number]) => ({
            id: row.id,
            postingCode: row.postingCode,
            debitAccountNo: row.debitAccountNo,
            creditAccountNo: row.creditAccountNo,
            enabled: row.enabled,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          })),
          200,
        );
      } catch (error) {
        return handleAccountingRouteError(c, error);
      }
    })
    .openapi(validatePostingMatrixRoute, async (c) => {
      const result = await ctx.accountingService.validatePostingMatrix();
      return c.json(result, 200);
    });
}

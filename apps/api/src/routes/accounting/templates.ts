import { createRoute, z } from "@hono/zod-openapi";

import { AccountingTemplateAccountSchema } from "@bedrock/application/accounting/contracts";

import type { AppContext } from "../../context";
import { requirePermission } from "../../middleware/permission";
import type { AccountingRoutesApp } from "./report-route-kit";

export function registerAccountingTemplateRoutes(
  app: AccountingRoutesApp,
  ctx: AppContext,
) {
  const listTemplateAccountsRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/template/accounts",
    tags: ["Accounting"],
    summary: "List global chart template accounts",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(AccountingTemplateAccountSchema),
          },
        },
        description: "Template accounts",
      },
    },
  });

  app.openapi(listTemplateAccountsRoute, async (c) => {
    const rows = await ctx.accountingService.listTemplateAccounts();
    return c.json(
      rows.map((row: (typeof rows)[number]) => ({
        accountNo: row.accountNo,
        name: row.name,
        kind: row.kind,
        normalSide: row.normalSide,
        postingAllowed: row.postingAllowed,
        enabled: row.enabled,
        parentAccountNo: row.parentAccountNo,
        createdAt: row.createdAt.toISOString(),
      })),
      200,
    );
  });

  return app;
}

import { createRoute, z } from "@hono/zod-openapi";

import { AccountingTemplateAccountSchema } from "@bedrock/accounting/contracts";

import { createAccountingRouteApp } from "./report-route-kit";
import type { AppContext } from "../../context";
import { requirePermission } from "../../middleware/permission";

export function accountingTemplateRoutes(ctx: AppContext) {
  const app = createAccountingRouteApp();

  const listTemplateAccountsRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/accounts",
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

  return app.openapi(listTemplateAccountsRoute, async (c) => {
    const rows = await ctx.accountingService.chart.listTemplateAccounts();
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
}

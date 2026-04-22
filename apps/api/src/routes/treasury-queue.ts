import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  ListTreasuryExceptionQueueInputSchema,
  TreasuryExceptionQueueRowKindSchema,
  TreasuryExceptionQueueRowSchema,
} from "@bedrock/deals/contracts";

import { handleRouteError } from "../common/errors";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const TreasuryExceptionQueueResponseSchema = z.object({
  data: z.array(TreasuryExceptionQueueRowSchema),
});

export function treasuryQueueRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listQueryRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Treasury"],
    summary: "List treasury exception queue rows",
    request: {
      query: z.object({
        currencyCode: z.string().optional(),
        dealId: z.uuid().optional(),
        internalEntityOrganizationId: z.uuid().optional(),
        kind: TreasuryExceptionQueueRowKindSchema.optional(),
        limit: z.coerce.number().int().positive().max(500).optional(),
      }),
    },
    responses: {
      200: {
        description: "Treasury exception queue",
        content: {
          "application/json": {
            schema: TreasuryExceptionQueueResponseSchema,
          },
        },
      },
    },
  });

  return app.openapi(listQueryRoute, async (c) => {
    try {
      const query = c.req.valid("query");
      const parsed = ListTreasuryExceptionQueueInputSchema.parse({
        currencyCode: query.currencyCode,
        dealId: query.dealId,
        internalEntityOrganizationId: query.internalEntityOrganizationId,
        kind: query.kind,
        limit: query.limit ?? 100,
      });
      const rows =
        await ctx.dealsModule.deals.queries.listTreasuryExceptionQueue(parsed);
      return c.json({ data: rows }, 200);
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
}

import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  ListActivitiesQuerySchema,
  PaginatedActivityLogSchema,
} from "@bedrock/operations/contracts";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";

export function operationsActivityLogRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Operations - Activity Log"],
    summary: "List activity log entries",
    request: { query: ListActivitiesQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PaginatedActivityLogSchema },
        },
        description: "Paginated activity log",
      },
    },
  });

  return app.openapi(listRoute, async (c) => {
    const query = c.req.valid("query");
    const result = await ctx.operationsModule.activityLog.queries.list(query);
    return c.json(result, 200);
  });
}

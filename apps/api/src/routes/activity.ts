import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const ActivityItemSchema = z.object({
  id: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  entityTitle: z.string().nullable(),
  source: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  userId: z.string().nullable(),
  userName: z.string().nullable(),
});

export function activityRoutes(_ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/",
    request: {
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(10),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              data: z.array(ActivityItemSchema),
            }),
          },
        },
        description: "Activity projection",
      },
    },
    summary: "List final activity feed items",
    tags: ["Activity"],
  });

  return app.openapi(listRoute, async (c): Promise<any> => {
    const { limit } = c.req.valid("query");

    return c.json(
      {
        data: [] as z.infer<typeof ActivityItemSchema>[],
        limit,
      },
      200,
    );
  });
}

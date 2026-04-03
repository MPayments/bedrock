import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  isAdmin: z.boolean(),
});

export function agentsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ users: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Agents"],
    summary: "List CRM-visible agents",
    responses: {
      200: {
        content: { "application/json": { schema: z.array(AgentSchema) } },
        description: "Agents",
      },
    },
  });

  return app.openapi(listRoute, async (c): Promise<any> => {
    const users: Awaited<ReturnType<typeof ctx.iamService.queries.list>>["data"] =
      [];
    let offset = 0;
    let total = 0;

    do {
      const page = await ctx.iamService.queries.list({
        banned: false,
        limit: MAX_QUERY_LIST_LIMIT,
        offset,
        role: ["admin", "agent", "user"],
        sortBy: "name",
        sortOrder: "asc",
      });

      users.push(...page.data);
      total = page.total;
      offset += page.limit;
    } while (offset < total);

    return c.json(
      users.map((user) => ({
        email: user.email,
        id: user.id,
        isAdmin: user.role === "admin",
        name: user.name,
      })),
      200,
    );
  });
}

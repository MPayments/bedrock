import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  ApplicationSchema,
  CreateApplicationInputSchema,
  CreateDealInputSchema,
  DealSchema,
  ListApplicationsQuerySchema,
  PaginatedApplicationsSchema,
  TakeApplicationInputSchema,
  UpdateApplicationCommentInputSchema,
  UpdateApplicationStatusInputSchema,
  ApplicationsStatisticsQuerySchema,
  ApplicationsStatisticsSchema,
  ApplicationsByDayQuerySchema,
  ApplicationsByDaySchema,
} from "@bedrock/operations/contracts";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsErrorSchema, OpsIdParamSchema } from "./common";

export function operationsApplicationsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Operations - Applications"],
    summary: "List applications",
    request: { query: ListApplicationsQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PaginatedApplicationsSchema },
        },
        description: "Paginated list of applications",
      },
    },
  });

  const getRoute = createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Operations - Applications"],
    summary: "Get application by ID",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: ApplicationSchema } },
        description: "Application found",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Not found",
      },
    },
  });

  const createRoute_ = createRoute({
    method: "post",
    path: "/",
    tags: ["Operations - Applications"],
    summary: "Create application",
    request: {
      body: {
        content: {
          "application/json": { schema: CreateApplicationInputSchema },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: ApplicationSchema } },
        description: "Application created",
      },
    },
  });

  const takeRoute = createRoute({
    method: "post",
    path: "/{id}/take",
    tags: ["Operations - Applications"],
    summary: "Take/assign application",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: TakeApplicationInputSchema.omit({ applicationId: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: ApplicationSchema } },
        description: "Application assigned",
      },
    },
  });

  const rejectRoute = createRoute({
    method: "patch",
    path: "/{id}/reject",
    tags: ["Operations - Applications"],
    summary: "Reject application",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: ApplicationSchema } },
        description: "Application rejected",
      },
    },
  });

  const commentRoute = createRoute({
    method: "patch",
    path: "/{id}/comment",
    tags: ["Operations - Applications"],
    summary: "Update application comment",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateApplicationCommentInputSchema.omit({ id: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: ApplicationSchema } },
        description: "Comment updated",
      },
    },
  });

  const statisticsRoute = createRoute({
    method: "get",
    path: "/statistics",
    tags: ["Operations - Applications"],
    summary: "Get applications statistics",
    request: { query: ApplicationsStatisticsQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: ApplicationsStatisticsSchema },
        },
        description: "Statistics",
      },
    },
  });

  const byDayRoute = createRoute({
    method: "get",
    path: "/by-day",
    tags: ["Operations - Applications"],
    summary: "Get applications grouped by day",
    request: { query: ApplicationsByDayQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: ApplicationsByDaySchema } },
        description: "By-day breakdown",
      },
    },
  });

  // Create deal from application
  const createDealRoute = createRoute({
    method: "post",
    path: "/{id}/deal",
    tags: ["Operations - Applications"],
    summary: "Create deal from application",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CreateDealInputSchema.omit({ applicationId: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: DealSchema } },
        description: "Deal created",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Application not found",
      },
    },
  });

  const unassignedRoute = createRoute({
    method: "get",
    path: "/unassigned",
    tags: ["Operations - Applications"],
    summary: "List unassigned applications",
    request: {
      query: z.object({
        limit: z.coerce.number().int().default(20),
        offset: z.coerce.number().int().default(0),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: PaginatedApplicationsSchema },
        },
        description: "Unassigned applications",
      },
    },
  });

  return app
    .openapi(statisticsRoute, async (c) => {
      const query = c.req.valid("query");
      const result =
        await ctx.operationsModule.applications.queries.getStatistics(query);
      return c.json(result, 200);
    })
    .openapi(byDayRoute, async (c) => {
      const query = c.req.valid("query");
      const data =
        await ctx.operationsModule.applications.queries.getByDay(query);
      return c.json({ data }, 200);
    })
    .openapi(unassignedRoute, async (c) => {
      const query = c.req.valid("query");
      const result =
        await ctx.operationsModule.applications.queries.listUnassigned(query);
      return c.json(result, 200);
    })
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result =
        await ctx.operationsModule.applications.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      const app_ =
        await ctx.operationsModule.applications.queries.findById(id);
      if (!app_) return c.json({ error: "Application not found" }, 404);
      return c.json(app_, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.applications.commands.create(input);
      return c.json(result, 201);
    })
    .openapi(takeRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.applications.commands.take({
        ...input,
        applicationId: id,
      });
      return c.json(result as NonNullable<typeof result>, 200);
    })
    .openapi(rejectRoute, async (c) => {
      const { id } = c.req.valid("param");
      const result =
        await ctx.operationsModule.applications.commands.updateStatus({
          id,
          status: "rejected",
        });
      return c.json(result!, 200);
    })
    .openapi(commentRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.applications.commands.updateComment({
          ...input,
          id,
        });
      return c.json(result!, 200);
    })
    .openapi(createDealRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.deals.commands.create({
        ...input,
        applicationId: id,
      });
      return c.json(result, 201);
    });
}

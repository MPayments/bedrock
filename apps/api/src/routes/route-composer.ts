import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  CreateDealRouteTemplateInputSchema,
  DealRouteTemplateSchema,
  DealRouteTemplateStatusSchema,
  DealTypeSchema,
  UpdateDealRouteTemplateInputSchema,
} from "@bedrock/deals/contracts";
import { RouteComposerLookupContextSchema } from "@bedrock/parties/contracts";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

export function routeComposerRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const RouteTemplateIdParamSchema = z.object({
    id: z
      .string()
      .uuid()
      .openapi({
        param: {
          in: "path",
          name: "id",
        },
      }),
  });
  const RouteTemplateListQuerySchema = z.object({
    dealType: DealTypeSchema.optional(),
    status: z
      .union([DealRouteTemplateStatusSchema, z.array(DealRouteTemplateStatusSchema)])
      .optional()
      .transform((value) => {
        if (!value) {
          return undefined;
        }

        return Array.isArray(value) ? value : [value];
      }),
  });

  const lookupContextRoute = createRoute({
    middleware: [
      requirePermission({
        counterparties: ["list"],
        customers: ["list"],
        organizations: ["list"],
      }),
    ],
    method: "get",
    path: "/lookup-context",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RouteComposerLookupContextSchema,
          },
        },
        description: "Route composer participant semantics and lookup defaults",
      },
    },
    summary: "Get route composer lookup context",
    tags: ["Route Composer"],
  });

  const listTemplatesRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/templates",
    request: {
      query: RouteTemplateListQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(DealRouteTemplateSchema.omit({
              costComponents: true,
              legs: true,
              participants: true,
            })),
          },
        },
        description: "Available route templates",
      },
    },
    summary: "List route templates",
    tags: ["Route Composer"],
  });

  const getTemplateRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/templates/{id}",
    request: {
      params: RouteTemplateIdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealRouteTemplateSchema,
          },
        },
        description: "Route template details",
      },
    },
    summary: "Get route template by id",
    tags: ["Route Composer"],
  });

  const createTemplateRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/templates",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateDealRouteTemplateInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: DealRouteTemplateSchema,
          },
        },
        description: "Route template created",
      },
    },
    summary: "Create route template",
    tags: ["Route Composer"],
  });

  const updateTemplateRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "put",
    path: "/templates/{id}",
    request: {
      params: RouteTemplateIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateDealRouteTemplateInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealRouteTemplateSchema,
          },
        },
        description: "Route template updated",
      },
    },
    summary: "Update draft route template",
    tags: ["Route Composer"],
  });

  const publishTemplateRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/templates/{id}/publish",
    request: {
      params: RouteTemplateIdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealRouteTemplateSchema,
          },
        },
        description: "Route template published",
      },
    },
    summary: "Publish route template",
    tags: ["Route Composer"],
  });

  const archiveTemplateRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/templates/{id}/archive",
    request: {
      params: RouteTemplateIdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealRouteTemplateSchema,
          },
        },
        description: "Route template archived",
      },
    },
    summary: "Archive route template",
    tags: ["Route Composer"],
  });

  return app
    .openapi(lookupContextRoute, async (c) => {
      const result =
        await ctx.partiesModule.participants.queries.getLookupContext();
      return c.json(result, 200);
    })
    .openapi(listTemplatesRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.dealsModule.deals.queries.listRouteTemplates(query);
      return c.json(result, 200);
    })
    .openapi(getTemplateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const result = await ctx.dealsModule.deals.queries.findRouteTemplateById(id);
      return c.json(result, 200);
    })
    .openapi(createTemplateRoute, async (c) => {
      const body = c.req.valid("json");
      const result = await ctx.dealsModule.deals.commands.createRouteTemplate(body);
      return c.json(result, 201);
    })
    .openapi(updateTemplateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await ctx.dealsModule.deals.commands.updateRouteTemplate({
        ...body,
        templateId: id,
      });
      return c.json(result, 200);
    })
    .openapi(publishTemplateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const result = await ctx.dealsModule.deals.commands.publishRouteTemplate({
        templateId: id,
      });
      return c.json(result, 200);
    })
    .openapi(archiveTemplateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const result = await ctx.dealsModule.deals.commands.archiveRouteTemplate({
        templateId: id,
      });
      return c.json(result, 200);
    });
}

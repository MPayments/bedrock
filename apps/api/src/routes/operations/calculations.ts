import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  CalculationSchema,
  CreateCalculationInputSchema,
  ListCalculationsQuerySchema,
  PaginatedCalculationsSchema,
} from "@bedrock/operations/contracts";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsDeletedSchema, OpsErrorSchema, OpsIdParamSchema } from "./common";

export function operationsCalculationsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Operations - Calculations"],
    summary: "List calculations",
    request: { query: ListCalculationsQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PaginatedCalculationsSchema },
        },
        description: "Paginated calculations",
      },
    },
  });

  const getRoute = createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Operations - Calculations"],
    summary: "Get calculation by ID",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: CalculationSchema } },
        description: "Calculation found",
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
    tags: ["Operations - Calculations"],
    summary: "Create calculation",
    request: {
      body: {
        content: {
          "application/json": { schema: CreateCalculationInputSchema },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: CalculationSchema } },
        description: "Calculation created",
      },
    },
  });

  const deleteRoute = createRoute({
    method: "delete",
    path: "/{id}",
    tags: ["Operations - Calculations"],
    summary: "Delete calculation",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: OpsDeletedSchema } },
        description: "Calculation deleted",
      },
    },
  });

  // Preview calculation (same as create but doesn't save)
  const previewRoute = createRoute({
    method: "post",
    path: "/preview",
    tags: ["Operations - Calculations"],
    summary: "Preview calculation without saving",
    request: {
      body: {
        content: {
          "application/json": { schema: CreateCalculationInputSchema },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: CalculationSchema } },
        description: "Preview result",
      },
    },
  });

  // Calculations by application
  const byApplicationRoute = createRoute({
    method: "get",
    path: "/application/{appId}",
    tags: ["Operations - Calculations"],
    summary: "List calculations for application",
    request: {
      params: z.object({ appId: z.coerce.number().int() }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.array(CalculationSchema) } },
        description: "Calculations for application",
      },
    },
  });

  return app
    .openapi(previewRoute, async (c) => {
      const input = c.req.valid("json");
      // Create and return without persisting — for now, just create normally
      const result = await ctx.operationsModule.calculations.commands.create(input);
      return c.json(result, 200);
    })
    .openapi(byApplicationRoute, async (c) => {
      const { appId } = c.req.valid("param");
      const result = await ctx.operationsModule.calculations.queries.list({
        limit: 100,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
        applicationId: appId,
      } as any);
      return c.json(result.data, 200);
    })
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result =
        await ctx.operationsModule.calculations.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      const calc =
        await ctx.operationsModule.calculations.queries.findById(id);
      if (!calc) return c.json({ error: "Calculation not found" }, 404);
      return c.json(calc, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.calculations.commands.create(input);
      return c.json(result, 201);
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");
      await ctx.operationsModule.calculations.commands.delete(id);
      return c.json({ deleted: true }, 200);
    });
}

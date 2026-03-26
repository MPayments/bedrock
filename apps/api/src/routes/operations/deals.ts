import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  CreateDealInputSchema,
  DealDocumentSchema,
  DealSchema,
  ListDealsQuerySchema,
  PaginatedDealsSchema,
  SetAgentBonusInputSchema,
  UpdateDealDetailsInputSchema,
  UpdateDealStatusInputSchema,
  DealsStatisticsQuerySchema,
  DealsStatisticsSchema,
  DealsByDayQuerySchema,
  DealsByDaySchema,
  DealsByStatusSchema,
} from "@bedrock/operations/contracts";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsErrorSchema, OpsIdParamSchema } from "./common";

export function operationsDealsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Operations - Deals"],
    summary: "List deals",
    request: { query: ListDealsQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: PaginatedDealsSchema } },
        description: "Paginated list of deals",
      },
    },
  });

  const getRoute = createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Operations - Deals"],
    summary: "Get deal with details",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Deal with details",
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
    tags: ["Operations - Deals"],
    summary: "Create deal",
    request: {
      body: {
        content: { "application/json": { schema: CreateDealInputSchema } },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: DealSchema } },
        description: "Deal created",
      },
    },
  });

  const updateStatusRoute = createRoute({
    method: "patch",
    path: "/{id}/status",
    tags: ["Operations - Deals"],
    summary: "Update deal status",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateDealStatusInputSchema.omit({ id: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: DealSchema } },
        description: "Status updated",
      },
    },
  });

  const updateDetailsRoute = createRoute({
    method: "patch",
    path: "/{id}/details",
    tags: ["Operations - Deals"],
    summary: "Update deal details",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateDealDetailsInputSchema.omit({ id: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: DealSchema } },
        description: "Details updated",
      },
    },
  });

  const setBonusRoute = createRoute({
    method: "post",
    path: "/{id}/bonus",
    tags: ["Operations - Deals"],
    summary: "Set agent bonus for deal",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: SetAgentBonusInputSchema.omit({ dealId: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Bonus set",
      },
    },
  });

  const statisticsRoute = createRoute({
    method: "get",
    path: "/statistics",
    tags: ["Operations - Deals"],
    summary: "Get deals statistics",
    request: { query: DealsStatisticsQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: DealsStatisticsSchema } },
        description: "Statistics",
      },
    },
  });

  const byDayRoute = createRoute({
    method: "get",
    path: "/by-day",
    tags: ["Operations - Deals"],
    summary: "Get deals grouped by day",
    request: { query: DealsByDayQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: DealsByDaySchema } },
        description: "By-day breakdown",
      },
    },
  });

  // Deal documents
  const listDocumentsRoute = createRoute({
    method: "get",
    path: "/{id}/documents",
    tags: ["Operations - Deals"],
    summary: "List deal documents",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.array(DealDocumentSchema) },
        },
        description: "Deal documents",
      },
    },
  });

  const deleteDocumentRoute = createRoute({
    method: "delete",
    path: "/{id}/documents/{docId}",
    tags: ["Operations - Deals"],
    summary: "Delete deal document",
    request: {
      params: OpsIdParamSchema.extend({
        docId: z.coerce.number().int(),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ deleted: z.boolean() }) } },
        description: "Document deleted",
      },
    },
  });

  const byStatusRoute = createRoute({
    method: "get",
    path: "/by-status",
    tags: ["Operations - Deals"],
    summary: "Get deals grouped by status",
    responses: {
      200: {
        content: { "application/json": { schema: DealsByStatusSchema } },
        description: "By-status breakdown",
      },
    },
  });

  return app
    .openapi(statisticsRoute, async (c) => {
      const query = c.req.valid("query");
      const result =
        await ctx.operationsModule.deals.queries.getStatistics(query);
      return c.json(result, 200);
    })
    .openapi(byDayRoute, async (c) => {
      const query = c.req.valid("query");
      const data = await ctx.operationsModule.deals.queries.getByDay(query);
      return c.json({ data }, 200);
    })
    .openapi(byStatusRoute, async (c) => {
      const data = await ctx.operationsModule.deals.queries.getByStatus();
      return c.json({ data }, 200);
    })
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.operationsModule.deals.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      const deal =
        await ctx.operationsModule.deals.queries.findByIdWithDetails(id);
      if (!deal) return c.json({ error: "Deal not found" }, 404);
      return c.json(deal, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.deals.commands.create(input);
      return c.json(result, 201);
    })
    .openapi(updateStatusRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.deals.commands.updateStatus({
          ...input,
          id,
        });
      return c.json(result as NonNullable<typeof result>, 200);
    })
    .openapi(updateDetailsRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.deals.commands.updateDetails({
          ...input,
          id,
        });
      return c.json(result as NonNullable<typeof result>, 200);
    })
    .openapi(setBonusRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.deals.commands.setAgentBonus({
          dealId: id,
          ...input,
        });
      return c.json(result, 200);
    })
    .openapi(listDocumentsRoute, async (c) => {
      const { id } = c.req.valid("param");
      const result =
        await ctx.operationsModule.deals.queries.listDocuments(id);
      return c.json(result, 200);
    })
    .openapi(deleteDocumentRoute, async (c) => {
      const { docId } = c.req.valid("param");
      const docs = ctx.operationsModule.deals.documents;
      if (docs) await docs.commands.delete(docId);
      return c.json({ deleted: true }, 200);
    });
}

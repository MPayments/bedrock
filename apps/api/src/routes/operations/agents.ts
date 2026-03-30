import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  ListAgentsQuerySchema,
  PaginatedAgentsSchema,
  CreateSubAgentInputSchema,
  ListSubAgentsQuerySchema,
  PaginatedSubAgentsSchema,
  SubAgentSchema,
  UpdateSubAgentInputSchema,
} from "@bedrock/operations/contracts";
import { SubAgentProfileNotFoundError } from "@bedrock/parties";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { DeletedSchema, IdParamSchema } from "../../common";

function mapCanonicalSubAgentToFacade(input: {
  commissionRate: number;
  counterpartyId: string;
  isActive: boolean;
  kind: "individual" | "legal_entity";
  shortName: string;
}) {
  return {
    commission: input.commissionRate,
    id: input.counterpartyId,
    isActive: input.isActive,
    kind: input.kind,
    name: input.shortName,
  };
}

export function operationsAgentsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Operations - Agents"],
    summary: "List agents",
    request: { query: ListAgentsQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: PaginatedAgentsSchema } },
        description: "Paginated agents",
      },
    },
  });

  // Sub-agents
  const listSubAgentsRoute = createRoute({
    method: "get",
    path: "/sub-agents",
    tags: ["Operations - Agents"],
    summary: "List sub-agents",
    request: { query: ListSubAgentsQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PaginatedSubAgentsSchema },
        },
        description: "Paginated sub-agents",
      },
    },
  });

  const createSubAgentRoute = createRoute({
    method: "post",
    path: "/sub-agents",
    tags: ["Operations - Agents"],
    summary: "Create sub-agent",
    request: {
      body: {
        content: {
          "application/json": { schema: CreateSubAgentInputSchema },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: SubAgentSchema } },
        description: "Created",
      },
    },
  });

  const updateSubAgentRoute = createRoute({
    method: "patch",
    path: "/sub-agents/{id}",
    tags: ["Operations - Agents"],
    summary: "Update sub-agent",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateSubAgentInputSchema.omit({ id: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: SubAgentSchema } },
        description: "Updated",
      },
    },
  });

  const deleteSubAgentRoute = createRoute({
    method: "delete",
    path: "/sub-agents/{id}",
    tags: ["Operations - Agents"],
    summary: "Archive sub-agent",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: { "application/json": { schema: DeletedSchema } },
        description: "Archived",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.operationsModule.agents.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(listSubAgentsRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.partiesModule.subAgentProfiles.queries.list({
        shortName: query.name,
        limit: query.limit,
        offset: query.offset,
        sortBy:
          query.sortBy === "commission" ? "commissionRate" : "shortName",
        sortOrder: query.sortOrder,
      });
      return c.json(
        {
          ...result,
          data: result.data.map(mapCanonicalSubAgentToFacade),
        },
        200,
      );
    })
    .openapi(createSubAgentRoute, async (c) => {
      const input = c.req.valid("json");
      const result = await ctx.partiesModule.subAgentProfiles.commands.create({
        commissionRate: input.commission,
        country: input.country ?? null,
        fullName: input.name,
        isActive: true,
        kind: input.kind,
        shortName: input.name,
      });
      return c.json(mapCanonicalSubAgentToFacade(result), 201);
    })
    .openapi(updateSubAgentRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        const result = await ctx.partiesModule.subAgentProfiles.commands.update(
          id,
          {
            commissionRate: input.commission,
            country: input.country,
            fullName: input.name,
            isActive: input.isActive,
            kind: input.kind,
            shortName: input.name,
          },
        );
        return c.json(mapCanonicalSubAgentToFacade(result), 200);
      } catch (error) {
        if (error instanceof SubAgentProfileNotFoundError) {
          return c.json({ error: error.message }, 404 as const);
        }

        throw error;
      }
    })
    .openapi(deleteSubAgentRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        await ctx.partiesModule.subAgentProfiles.commands.remove(id);
        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (error instanceof SubAgentProfileNotFoundError) {
          return c.json({ error: error.message }, 404 as const);
        }

        throw error;
      }
    });
}

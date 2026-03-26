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

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsIdParamSchema } from "./common";

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
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": { schema: UpdateSubAgentInputSchema },
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

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.operationsModule.agents.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(listSubAgentsRoute, async (c) => {
      const query = c.req.valid("query");
      const result =
        await ctx.operationsModule.agents.subAgents.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(createSubAgentRoute, async (c) => {
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.agents.subAgents.commands.create(input);
      return c.json(result, 201);
    })
    .openapi(updateSubAgentRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.agents.subAgents.commands.update({ ...input, id });
      return c.json(result, 200);
    });
}

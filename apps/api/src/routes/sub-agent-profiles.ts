import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  SubAgentProfileNotFoundError,
} from "@bedrock/parties";
import {
  CreateSubAgentProfileInputSchema,
  ListSubAgentProfilesQuerySchema,
  PaginatedSubAgentProfilesSchema,
  SubAgentProfileSchema,
  UpdateSubAgentProfileInputSchema,
} from "@bedrock/parties/contracts";

import { DeletedSchema, ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

export function subAgentProfilesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const CounterpartyIdParamSchema = z.object({
    counterpartyId: z.uuid().openapi({
      param: {
        in: "path",
        name: "counterpartyId",
        example: "00000000-0000-0000-0000-000000000001",
      },
    }),
  });

  const listRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Sub-Agent Profiles"],
    summary: "List sub-agent profiles",
    request: { query: ListSubAgentProfilesQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PaginatedSubAgentProfilesSchema },
        },
        description: "Paginated sub-agent profiles",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ counterparties: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Sub-Agent Profiles"],
    summary: "Create sub-agent profile",
    request: {
      body: {
        content: {
          "application/json": { schema: CreateSubAgentProfileInputSchema },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: SubAgentProfileSchema } },
        description: "Created sub-agent profile",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/{counterpartyId}",
    tags: ["Sub-Agent Profiles"],
    summary: "Get sub-agent profile",
    request: { params: CounterpartyIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: SubAgentProfileSchema } },
        description: "Sub-agent profile",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Sub-agent profile not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["update"] })],
    method: "patch",
    path: "/{counterpartyId}",
    tags: ["Sub-Agent Profiles"],
    summary: "Update sub-agent profile",
    request: {
      params: CounterpartyIdParamSchema,
      body: {
        content: {
          "application/json": { schema: UpdateSubAgentProfileInputSchema },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: SubAgentProfileSchema } },
        description: "Updated sub-agent profile",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Sub-agent profile not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["delete"] })],
    method: "delete",
    path: "/{counterpartyId}",
    tags: ["Sub-Agent Profiles"],
    summary: "Archive sub-agent profile",
    request: { params: CounterpartyIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: DeletedSchema } },
        description: "Sub-agent profile archived",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Sub-agent profile not found",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.partiesModule.subAgentProfiles.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const result = await ctx.partiesModule.subAgentProfiles.commands.create(input);
      return c.json(result, 201);
    })
    .openapi(getRoute, async (c) => {
      const { counterpartyId } = c.req.valid("param");

      try {
        const result =
          await ctx.partiesModule.subAgentProfiles.queries.findById(
            counterpartyId,
          );
        return c.json(result, 200);
      } catch (error) {
        if (error instanceof SubAgentProfileNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    })
    .openapi(updateRoute, async (c) => {
      const { counterpartyId } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const result = await ctx.partiesModule.subAgentProfiles.commands.update(
          counterpartyId,
          input,
        );
        return c.json(result, 200);
      } catch (error) {
        if (error instanceof SubAgentProfileNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    })
    .openapi(deleteRoute, async (c) => {
      const { counterpartyId } = c.req.valid("param");

      try {
        await ctx.partiesModule.subAgentProfiles.commands.remove(counterpartyId);
        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (error instanceof SubAgentProfileNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    });
}

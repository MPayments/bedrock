import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { SubAgentProfileNotFoundError } from "@bedrock/parties";

import { DeletedSchema, ErrorSchema, IdParamSchema } from "../common";
import { handleRouteError } from "../common/errors";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  isAdmin: z.boolean(),
});

const SubAgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  commission: z.number(),
  kind: z.enum(["individual", "legal_entity"]),
  isActive: z.boolean(),
  country: z.string().nullable(),
});

const CreateSubAgentInputSchema = z.object({
  commission: z.number(),
  country: z.string().nullable().optional(),
  kind: z.enum(["individual", "legal_entity"]),
  name: z.string().min(1),
});

const UpdateSubAgentInputSchema = CreateSubAgentInputSchema.extend({
  isActive: z.boolean().optional(),
});

function serializeSubAgent(input: {
  commissionRate: number;
  counterpartyId: string;
  country: string | null;
  isActive: boolean;
  kind: "individual" | "legal_entity";
  shortName: string;
}) {
  return {
    commission: input.commissionRate,
    country: input.country,
    id: input.counterpartyId,
    isActive: input.isActive,
    kind: input.kind,
    name: input.shortName,
  };
}

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

  const listSubAgentsRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/sub-agents",
    tags: ["Agents"],
    summary: "List sub-agent profiles",
    responses: {
      200: {
        content: { "application/json": { schema: z.array(SubAgentSchema) } },
        description: "Sub-agents",
      },
    },
  });

  const createSubAgentRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["create"] })],
    method: "post",
    path: "/sub-agents",
    tags: ["Agents"],
    summary: "Create sub-agent profile",
    request: {
      body: {
        content: { "application/json": { schema: CreateSubAgentInputSchema } },
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
    middleware: [requirePermission({ counterparties: ["update"] })],
    method: "patch",
    path: "/sub-agents/{id}",
    tags: ["Agents"],
    summary: "Update sub-agent profile",
    request: {
      params: IdParamSchema,
      body: {
        content: { "application/json": { schema: UpdateSubAgentInputSchema } },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: SubAgentSchema } },
        description: "Updated",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Not found",
      },
    },
  });

  const deleteSubAgentRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["delete"] })],
    method: "delete",
    path: "/sub-agents/{id}",
    tags: ["Agents"],
    summary: "Archive sub-agent profile",
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
    .openapi(listRoute, async (c): Promise<any> => {
      const result = await ctx.iamService.queries.list({
        banned: false,
        limit: 500,
        offset: 0,
        role: ["admin", "agent", "user"],
        sortBy: "name",
        sortOrder: "asc",
      });

      return c.json(
        result.data.map((user) => ({
          email: user.email,
          id: user.id,
          isAdmin: user.role === "admin",
          name: user.name,
        })),
        200,
      );
    })
    .openapi(listSubAgentsRoute, async (c): Promise<any> => {
      const result = await ctx.partiesModule.subAgentProfiles.queries.list({
        limit: 500,
        offset: 0,
        sortBy: "shortName",
        sortOrder: "asc",
      });

      return c.json(result.data.map(serializeSubAgent), 200);
    })
    .openapi(createSubAgentRoute, async (c): Promise<any> => {
      const input = c.req.valid("json");
      const result = await ctx.partiesModule.subAgentProfiles.commands.create({
        commissionRate: input.commission,
        country: input.country ?? null,
        fullName: input.name,
        isActive: true,
        kind: input.kind,
        shortName: input.name,
      });

      return c.json(serializeSubAgent(result), 201);
    })
    .openapi(updateSubAgentRoute, async (c): Promise<any> => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const result = await ctx.partiesModule.subAgentProfiles.commands.update(
          id,
          {
            commissionRate: input.commission,
            country: input.country,
            fullName: input.name,
            isActive: input.isActive ?? true,
            kind: input.kind,
            shortName: input.name,
          },
        );
        return c.json(serializeSubAgent(result), 200);
      } catch (error) {
        if (error instanceof SubAgentProfileNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        return handleRouteError(c, error);
      }
    })
    .openapi(deleteSubAgentRoute, async (c): Promise<any> => {
      const { id } = c.req.valid("param");

      try {
        await ctx.partiesModule.subAgentProfiles.commands.remove(id);
        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (error instanceof SubAgentProfileNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        return handleRouteError(c, error);
      }
    });
}

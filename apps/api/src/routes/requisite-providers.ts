import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { RequisiteProviderNotFoundError } from "@bedrock/parties";
import {
  CreateRequisiteProviderInputSchema,
  ListRequisiteProvidersQuerySchema,
  RequisiteProviderBranchIdentifierInputSchema,
  RequisiteProviderBranchIdentifierSchema,
  RequisiteProviderBranchInputSchema,
  RequisiteProviderBranchSchema,
  RequisiteProviderIdentifierInputSchema,
  RequisiteProviderIdentifierSchema,
  RequisiteProviderOptionSchema,
  RequisiteProviderListItemSchema,
  RequisiteProviderOptionsResponseSchema,
  RequisiteProviderSchema,
  UpdateRequisiteProviderInputSchema,
} from "@bedrock/parties/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import {
  createPaginatedListSchema,
  MAX_QUERY_LIST_LIMIT,
} from "@bedrock/shared/core/pagination";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import { buildOptionsResponse } from "../common/options";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedRequisiteProvidersSchema = createPaginatedListSchema(
  RequisiteProviderListItemSchema,
);
const ProviderBranchParamSchema = IdParamSchema.extend({
  branchId: z.uuid(),
});
export function requisiteProvidersRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ requisites: ["providers_list"] })],
    method: "get",
    path: "/",
    tags: ["Requisite Providers"],
    summary: "List requisite providers",
    request: {
      query: ListRequisiteProvidersQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedRequisiteProvidersSchema,
          },
        },
        description: "Paginated list of requisite providers",
      },
    },
  });

  const optionsRoute = createRoute({
    middleware: [requirePermission({ requisites: ["providers_list"] })],
    method: "get",
    path: "/options",
    tags: ["Requisite Providers"],
    summary: "List requisite provider options",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteProviderOptionsResponseSchema,
          },
        },
        description: "Requisite provider option list",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ requisites: ["providers_create"] })],
    method: "post",
    path: "/",
    tags: ["Requisite Providers"],
    summary: "Create requisite provider",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateRequisiteProviderInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: RequisiteProviderSchema,
          },
        },
        description: "Requisite provider created",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ requisites: ["providers_list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Requisite Providers"],
    summary: "Get requisite provider by id",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteProviderSchema,
          },
        },
        description: "Requisite provider found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Requisite provider not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ requisites: ["providers_update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Requisite Providers"],
    summary: "Update requisite provider",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateRequisiteProviderInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteProviderSchema,
          },
        },
        description: "Requisite provider updated",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Requisite provider not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ requisites: ["providers_delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Requisite Providers"],
    summary: "Archive requisite provider",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DeletedSchema,
          },
        },
        description: "Requisite provider archived",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Requisite provider not found",
      },
    },
  });

  const getIdentifiersRoute = createRoute({
    middleware: [requirePermission({ requisites: ["providers_list"] })],
    method: "get",
    path: "/{id}/identifiers",
    tags: ["Requisite Providers"],
    summary: "List provider identifiers",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteProviderIdentifierSchema.array(),
          },
        },
        description: "Provider identifiers",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Requisite provider not found",
      },
    },
  });

  const putIdentifiersRoute = createRoute({
    middleware: [requirePermission({ requisites: ["providers_update"] })],
    method: "put",
    path: "/{id}/identifiers",
    tags: ["Requisite Providers"],
    summary: "Replace provider identifiers",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: RequisiteProviderIdentifierInputSchema.array(),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteProviderIdentifierSchema.array(),
          },
        },
        description: "Provider identifiers updated",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Requisite provider not found",
      },
    },
  });

  const getBranchesRoute = createRoute({
    middleware: [requirePermission({ requisites: ["providers_list"] })],
    method: "get",
    path: "/{id}/branches",
    tags: ["Requisite Providers"],
    summary: "List provider branches",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteProviderBranchSchema.array(),
          },
        },
        description: "Provider branches",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Requisite provider not found",
      },
    },
  });

  const putBranchesRoute = createRoute({
    middleware: [requirePermission({ requisites: ["providers_update"] })],
    method: "put",
    path: "/{id}/branches",
    tags: ["Requisite Providers"],
    summary: "Replace provider branches",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: RequisiteProviderBranchInputSchema.array(),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteProviderBranchSchema.array(),
          },
        },
        description: "Provider branches updated",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Requisite provider not found",
      },
    },
  });

  const getBranchIdentifiersRoute = createRoute({
    middleware: [requirePermission({ requisites: ["providers_list"] })],
    method: "get",
    path: "/{id}/branches/{branchId}/identifiers",
    tags: ["Requisite Providers"],
    summary: "List provider branch identifiers",
    request: {
      params: ProviderBranchParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteProviderBranchIdentifierSchema.array(),
          },
        },
        description: "Provider branch identifiers",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Requisite provider or branch not found",
      },
    },
  });

  const putBranchIdentifiersRoute = createRoute({
    middleware: [requirePermission({ requisites: ["providers_update"] })],
    method: "put",
    path: "/{id}/branches/{branchId}/identifiers",
    tags: ["Requisite Providers"],
    summary: "Replace provider branch identifiers",
    request: {
      params: ProviderBranchParamSchema,
      body: {
        content: {
          "application/json": {
            schema: RequisiteProviderBranchIdentifierInputSchema.array(),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteProviderBranchIdentifierSchema.array(),
          },
        },
        description: "Provider branch identifiers updated",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Requisite provider or branch not found",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.partiesModule.requisites.queries.listProviders(
        query,
      );
      return c.json(result, 200);
    })
    .openapi(optionsRoute, async (c) => {
      const result = await ctx.partiesModule.requisites.queries.listProviders({
        limit: MAX_QUERY_LIST_LIMIT,
        offset: 0,
        sortBy: "displayName",
        sortOrder: "asc",
      });

      return c.json(
        buildOptionsResponse(result.data, (item) =>
          RequisiteProviderOptionSchema.parse({
            id: item.id,
            kind: item.kind,
            displayName: item.displayName,
            label: item.displayName,
          }),
        ),
        200,
      );
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");

      try {
        const provider = await ctx.partiesModule.requisites.commands.createProvider(
          input,
        );
        return c.json(provider, 201);
      } catch (error) {
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const provider = await ctx.partiesModule.requisites.queries.findProviderById(
          id,
        );
        return c.json(provider, 200);
      } catch (error) {
        if (error instanceof RequisiteProviderNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const provider = await ctx.partiesModule.requisites.commands.updateProvider(
          id,
          input,
        );
        return c.json(provider, 200);
      } catch (error) {
        if (error instanceof RequisiteProviderNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        await ctx.partiesModule.requisites.commands.removeProvider(id);
        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (error instanceof RequisiteProviderNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(getIdentifiersRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const provider = await ctx.partiesModule.requisites.queries.findProviderById(
          id,
        );
        return c.json(provider.identifiers, 200);
      } catch (error) {
        if (error instanceof RequisiteProviderNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(putIdentifiersRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const provider = await ctx.partiesModule.requisites.commands.updateProvider(
          id,
          { identifiers: input },
        );
        return c.json(provider.identifiers, 200);
      } catch (error) {
        if (error instanceof RequisiteProviderNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(getBranchesRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const provider = await ctx.partiesModule.requisites.queries.findProviderById(
          id,
        );
        return c.json(provider.branches, 200);
      } catch (error) {
        if (error instanceof RequisiteProviderNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(putBranchesRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const provider = await ctx.partiesModule.requisites.commands.updateProvider(
          id,
          { branches: input },
        );
        return c.json(provider.branches, 200);
      } catch (error) {
        if (error instanceof RequisiteProviderNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(getBranchIdentifiersRoute, async (c) => {
      const { id, branchId } = c.req.valid("param");

      try {
        const provider = await ctx.partiesModule.requisites.queries.findProviderById(
          id,
        );
        const branch = provider.branches.find((item) => item.id === branchId);

        if (!branch) {
          return c.json({ error: `Requisite provider branch not found: ${branchId}` }, 404);
        }

        return c.json(branch.identifiers, 200);
      } catch (error) {
        if (error instanceof RequisiteProviderNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(putBranchIdentifiersRoute, async (c) => {
      const { id, branchId } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const current = await ctx.partiesModule.requisites.queries.findProviderById(
          id,
        );
        const branch = current.branches.find((item) => item.id === branchId);

        if (!branch) {
          return c.json({ error: `Requisite provider branch not found: ${branchId}` }, 404);
        }

        const provider = await ctx.partiesModule.requisites.commands.updateProvider(
          id,
          {
            branches: current.branches.map((item) =>
              item.id === branchId ? { ...item, identifiers: input } : item,
            ),
          },
        );
        const updatedBranch = provider.branches.find((item) => item.id === branchId);

        if (!updatedBranch) {
          return c.json({ error: `Requisite provider branch not found: ${branchId}` }, 404);
        }

        return c.json(updatedBranch.identifiers, 200);
      } catch (error) {
        if (error instanceof RequisiteProviderNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    });
}

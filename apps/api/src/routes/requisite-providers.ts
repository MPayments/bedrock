import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  CreateRequisiteProviderInputSchema,
  ListRequisiteProvidersQuerySchema,
  RequisiteProviderNotFoundError,
  RequisiteProviderSchema,
  UpdateRequisiteProviderInputSchema,
} from "@bedrock/requisites/providers";
import {
  RequisiteProviderOptionSchema,
  RequisiteProviderOptionsResponseSchema,
} from "@bedrock/requisites/providers/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import { buildOptionsResponse } from "../common/options";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedRequisiteProvidersSchema = createPaginatedListSchema(
  RequisiteProviderSchema,
);
const OPTIONS_LIMIT = 200;

export function requisiteProvidersRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ requisite_providers: ["list"] })],
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
    middleware: [requirePermission({ requisite_providers: ["list"] })],
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
    middleware: [requirePermission({ requisite_providers: ["create"] })],
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
    middleware: [requirePermission({ requisite_providers: ["list"] })],
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
    middleware: [requirePermission({ requisite_providers: ["update"] })],
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
    middleware: [requirePermission({ requisite_providers: ["delete"] })],
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

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.requisiteProvidersService.list(query);
      return c.json(result, 200);
    })
    .openapi(optionsRoute, async (c) => {
      const result = await ctx.requisiteProvidersService.list({
        limit: OPTIONS_LIMIT,
        offset: 0,
        sortBy: "name",
        sortOrder: "asc",
      });

      return c.json(
        buildOptionsResponse(result.data, (item) =>
          RequisiteProviderOptionSchema.parse({
            id: item.id,
            kind: item.kind,
            name: item.name,
            label: item.name,
          }),
        ),
        200,
      );
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");

      try {
        const provider = await ctx.requisiteProvidersService.create(input);
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
        const provider = await ctx.requisiteProvidersService.findById(id);
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
        const provider = await ctx.requisiteProvidersService.update(id, input);
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
        await ctx.requisiteProvidersService.remove(id);
        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (error instanceof RequisiteProviderNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    });
}

import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  CreateOrganizationInputSchema,
  ListOrganizationsQuerySchema,
  OrganizationDeleteConflictError,
  OrganizationNotFoundError,
  OrganizationSchema,
  UpdateOrganizationInputSchema,
} from "@bedrock/organizations";
import {
  OrganizationOptionSchema,
  OrganizationOptionsResponseSchema,
} from "@bedrock/organizations/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import { buildOptionsResponse } from "../common/options";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedOrganizationsSchema = createPaginatedListSchema(OrganizationSchema);
const OPTIONS_LIMIT = 200;

export function organizationsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ organizations: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Organizations"],
    summary: "List organizations",
    request: {
      query: ListOrganizationsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedOrganizationsSchema,
          },
        },
        description: "Paginated list of organizations",
      },
    },
  });

  const optionsRoute = createRoute({
    middleware: [requirePermission({ organizations: ["list"] })],
    method: "get",
    path: "/options",
    tags: ["Organizations"],
    summary: "List organization options",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OrganizationOptionsResponseSchema,
          },
        },
        description: "Organization option list",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ organizations: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Organizations"],
    summary: "Create an organization",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateOrganizationInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: OrganizationSchema,
          },
        },
        description: "Organization created",
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
    middleware: [requirePermission({ organizations: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Organizations"],
    summary: "Get organization by id",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OrganizationSchema,
          },
        },
        description: "Organization found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Organization not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ organizations: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Organizations"],
    summary: "Update organization",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateOrganizationInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OrganizationSchema,
          },
        },
        description: "Organization updated",
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
        description: "Organization not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ organizations: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Organizations"],
    summary: "Delete organization",
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
        description: "Organization deleted",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Organization is still referenced",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Organization not found",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.organizationsService.list(query);
      return c.json(result, 200);
    })
    .openapi(optionsRoute, async (c) => {
      const result = await ctx.organizationsService.list({
        limit: OPTIONS_LIMIT,
        offset: 0,
        sortBy: "shortName",
        sortOrder: "asc",
      });

      return c.json(
        buildOptionsResponse(result.data, (item) =>
          OrganizationOptionSchema.parse({
            id: item.id,
            shortName: item.shortName,
            label: item.shortName,
          }),
        ),
        200,
      );
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");

      try {
        const organization = await ctx.organizationsService.create(input);
        return c.json(organization, 201);
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
        const organization = await ctx.organizationsService.findById(id);
        return c.json(organization, 200);
      } catch (error) {
        if (error instanceof OrganizationNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const organization = await ctx.organizationsService.update(id, input);
        return c.json(organization, 200);
      } catch (error) {
        if (error instanceof OrganizationNotFoundError) {
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
        await ctx.organizationsService.remove(id);
        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (error instanceof OrganizationNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        if (error instanceof OrganizationDeleteConflictError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    });
}

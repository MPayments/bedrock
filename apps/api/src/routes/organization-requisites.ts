import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  CreateOrganizationRequisiteInputSchema,
  ListOrganizationRequisitesQuerySchema,
  OrganizationRequisiteBindingNotFoundError,
  OrganizationRequisiteBindingSchema,
  OrganizationRequisiteNotFoundError,
  OrganizationRequisiteOwnerNotInternalError,
  OrganizationRequisiteSchema,
  UpdateOrganizationRequisiteInputSchema,
  UpsertOrganizationRequisiteBindingInputSchema,
  ValidationError,
} from "@bedrock/core/organization-requisites";
import {
  OrganizationRequisiteOptionSchema,
  OrganizationRequisiteOptionsResponseSchema,
} from "@bedrock/core/organization-requisites/contracts";
import { createPaginatedListSchema } from "@bedrock/kernel/pagination";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import { buildOptionsResponse } from "../common/options";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedOrganizationRequisitesSchema = createPaginatedListSchema(
  OrganizationRequisiteSchema,
);

export function organizationRequisitesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ organization_requisites: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Organization Requisites"],
    summary: "List organization requisites",
    request: {
      query: ListOrganizationRequisitesQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedOrganizationRequisitesSchema,
          },
        },
        description: "Paginated list of organization requisites",
      },
    },
  });

  const optionsRoute = createRoute({
    middleware: [requirePermission({ organization_requisites: ["list"] })],
    method: "get",
    path: "/options",
    tags: ["Organization Requisites"],
    summary: "List organization requisite options",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OrganizationRequisiteOptionsResponseSchema,
          },
        },
        description: "Organization requisite option list",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ organization_requisites: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Organization Requisites"],
    summary: "Create a new organization requisite",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateOrganizationRequisiteInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: OrganizationRequisiteSchema,
          },
        },
        description: "Organization requisite created",
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
    middleware: [requirePermission({ organization_requisites: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Organization Requisites"],
    summary: "Get an organization requisite by ID",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OrganizationRequisiteSchema,
          },
        },
        description: "Organization requisite found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Organization requisite not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ organization_requisites: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Organization Requisites"],
    summary: "Update an organization requisite",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateOrganizationRequisiteInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OrganizationRequisiteSchema,
          },
        },
        description: "Organization requisite updated",
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
        description: "Organization requisite not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ organization_requisites: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Organization Requisites"],
    summary: "Archive an organization requisite",
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
        description: "Organization requisite archived",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Organization requisite not found",
      },
    },
  });

  const getBindingRoute = createRoute({
    middleware: [requirePermission({ organization_requisites: ["list"] })],
    method: "get",
    path: "/{id}/binding",
    tags: ["Organization Requisites"],
    summary: "Get the accounting binding for an organization requisite",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OrganizationRequisiteBindingSchema,
          },
        },
        description: "Organization requisite binding found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Organization requisite or binding not found",
      },
    },
  });

  const upsertBindingRoute = createRoute({
    middleware: [requirePermission({ organization_requisites: ["bind"] })],
    method: "patch",
    path: "/{id}/binding",
    tags: ["Organization Requisites"],
    summary: "Create or update the accounting binding for an organization requisite",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpsertOrganizationRequisiteBindingInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OrganizationRequisiteBindingSchema,
          },
        },
        description: "Organization requisite binding updated",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Organization requisite not found",
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

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.organizationRequisitesService.list(query);
      return c.json(result, 200);
    })
    .openapi(optionsRoute, async (c) => {
      const query = c.req.query("organizationId")
        ? { organizationId: c.req.query("organizationId") }
        : undefined;
      const result = await ctx.organizationRequisitesService.listOptions(query);

      return c.json(
        buildOptionsResponse(result, (item) =>
          OrganizationRequisiteOptionSchema.parse(item),
        ),
        200,
      );
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");

      try {
        const requisite = await ctx.organizationRequisitesService.create(input);
        return c.json(requisite, 201);
      } catch (err) {
        if (
          err instanceof OrganizationRequisiteOwnerNotInternalError ||
          err instanceof ValidationError
        ) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const requisite = await ctx.organizationRequisitesService.findById(id);
        return c.json(requisite, 200);
      } catch (err) {
        if (err instanceof OrganizationRequisiteNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const requisite = await ctx.organizationRequisitesService.update(
          id,
          input,
        );
        return c.json(requisite, 200);
      } catch (err) {
        if (err instanceof OrganizationRequisiteNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (
          err instanceof OrganizationRequisiteOwnerNotInternalError ||
          err instanceof ValidationError
        ) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        await ctx.organizationRequisitesService.remove(id);
        return c.json({ deleted: true }, 200);
      } catch (err) {
        if (err instanceof OrganizationRequisiteNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(getBindingRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const binding = await ctx.organizationRequisitesService.getBinding(id);
        return c.json(binding, 200);
      } catch (err) {
        if (
          err instanceof OrganizationRequisiteNotFoundError ||
          err instanceof OrganizationRequisiteBindingNotFoundError
        ) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(upsertBindingRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const binding = await ctx.organizationRequisitesService.upsertBinding(
          id,
          input,
        );
        return c.json(binding, 200);
      } catch (err) {
        if (err instanceof OrganizationRequisiteNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof ValidationError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    });
}

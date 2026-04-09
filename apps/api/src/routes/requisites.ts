import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  CounterpartyNotFoundError,
  OrganizationNotFoundError,
} from "@bedrock/parties";
import {
  RequisiteAccountingBindingNotFoundError,
  RequisiteAccountingBindingOwnerTypeError,
  RequisiteNotFoundError,
  RequisiteProviderNotFoundError,
  RequisiteProviderNotActiveError,
} from "@bedrock/parties";
import {
  ListRequisiteOptionsQuerySchema,
  ListRequisitesQuerySchema,
  RequisiteAccountingBindingSchema,
  RequisiteListItemSchema,
  RequisiteOptionsResponseSchema,
  RequisiteOptionSchema,
  RequisiteProviderSchema,
  RequisiteSchema,
  UpdateRequisiteInputSchema,
  UpsertRequisiteAccountingBindingInputSchema,
} from "@bedrock/parties/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import {
  createPaginatedListSchema,
} from "@bedrock/shared/core/pagination";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import { buildOptionsResponse } from "../common/options";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedRequisitesSchema = createPaginatedListSchema(
  RequisiteListItemSchema,
);

export function requisitesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ requisites: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Requisites"],
    summary: "List requisites",
    request: {
      query: ListRequisitesQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedRequisitesSchema,
          },
        },
        description: "Paginated list of requisites",
      },
    },
  });

  const optionsRoute = createRoute({
    middleware: [requirePermission({ requisites: ["list"] })],
    method: "get",
    path: "/options",
    tags: ["Requisites"],
    summary: "List requisite options",
    request: {
      query: ListRequisiteOptionsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteOptionsResponseSchema,
          },
        },
        description: "Requisite option list",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ requisites: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Requisites"],
    summary: "Get requisite by id",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteSchema,
          },
        },
        description: "Requisite found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Requisite not found",
      },
    },
  });

  const getProviderRoute = createRoute({
    middleware: [requirePermission({ requisites: ["list"] })],
    method: "get",
    path: "/{id}/provider",
    tags: ["Requisites"],
    summary: "Get resolved provider for a requisite",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteProviderSchema.nullable(),
          },
        },
        description: "Resolved requisite provider or null when the relation is dangling",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Requisite not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ requisites: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Requisites"],
    summary: "Update requisite",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateRequisiteInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteSchema,
          },
        },
        description: "Requisite updated",
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
        description: "Requisite not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ requisites: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Requisites"],
    summary: "Archive requisite",
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
        description: "Requisite archived",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Requisite not found",
      },
    },
  });

  const getBindingRoute = createRoute({
    middleware: [requirePermission({ requisites: ["list"] })],
    method: "get",
    path: "/{id}/binding",
    tags: ["Requisites"],
    summary: "Get requisite accounting binding",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteAccountingBindingSchema,
          },
        },
        description: "Requisite binding found",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Binding owner type is invalid",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Binding not found",
      },
    },
  });

  const upsertBindingRoute = createRoute({
    middleware: [requirePermission({ requisites: ["configure_binding"] })],
    method: "patch",
    path: "/{id}/binding",
    tags: ["Requisites"],
    summary: "Create or update requisite accounting binding",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpsertRequisiteAccountingBindingInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteAccountingBindingSchema,
          },
        },
        description: "Requisite binding upserted",
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
        description: "Requisite not found",
      },
    },
  });

  function handleMutationError(error: unknown) {
    if (
      error instanceof ValidationError ||
      error instanceof RequisiteProviderNotActiveError ||
      error instanceof RequisiteAccountingBindingOwnerTypeError
    ) {
      return { status: 400 as const, body: { error: error.message } };
    }

    if (
      error instanceof RequisiteNotFoundError ||
      error instanceof OrganizationNotFoundError ||
      error instanceof CounterpartyNotFoundError
    ) {
      return { status: 404 as const, body: { error: error.message } };
    }

    return null;
  }

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.partiesModule.requisites.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(optionsRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.partiesModule.requisites.queries.listOptions(
        query,
      );

      return c.json(
        buildOptionsResponse(result, (item) =>
          RequisiteOptionSchema.parse(item),
        ),
        200,
      );
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const requisite = await ctx.partiesModule.requisites.queries.findById(
          id,
        );
        return c.json(requisite, 200);
      } catch (error) {
        if (error instanceof RequisiteNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(getProviderRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const requisite = await ctx.partiesModule.requisites.queries.findById(id);
        try {
          const provider =
            await ctx.partiesModule.requisites.queries.findProviderById(
              requisite.providerId,
            );
          return c.json(provider, 200);
        } catch (error) {
          if (error instanceof RequisiteProviderNotFoundError) {
            return c.json(null, 200);
          }
          throw error;
        }
      } catch (error) {
        if (error instanceof RequisiteNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const requisite = await ctx.requisiteAccountingWorkflow.update(
          id,
          input,
        );
        return c.json(requisite, 200);
      } catch (error) {
        const handled = handleMutationError(error);
        if (handled) {
          return c.json(handled.body, handled.status);
        }
        throw error;
      }
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        await ctx.partiesModule.requisites.commands.remove(id);
        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (error instanceof RequisiteNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(getBindingRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const binding = await ctx.partiesModule.requisites.queries.getBinding(
          id,
        );
        return c.json(binding, 200);
      } catch (error) {
        if (
          error instanceof RequisiteNotFoundError ||
          error instanceof RequisiteAccountingBindingNotFoundError
        ) {
          return c.json({ error: error.message }, 404);
        }
        if (error instanceof RequisiteAccountingBindingOwnerTypeError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(upsertBindingRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const binding = await ctx.requisiteAccountingWorkflow.upsertBinding(
          id,
          input,
        );
        return c.json(binding, 200);
      } catch (error) {
        const handled = handleMutationError(error);
        if (handled) {
          return c.json(handled.body, handled.status);
        }
        throw error;
      }
    });
}

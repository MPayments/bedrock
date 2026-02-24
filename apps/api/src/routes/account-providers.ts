import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  AccountProviderSchema,
  AccountProviderNotFoundError,
  AccountProviderInUseError,
  ValidationError,
  CreateProviderInputSchema,
  UpdateProviderInputSchema,
  ListProvidersQuerySchema,
} from "@bedrock/accounts";
import { createPaginatedListSchema } from "@bedrock/kernel/pagination";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedAccountProvidersSchema = createPaginatedListSchema(
  AccountProviderSchema,
);

export function accountProvidersRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ accounts: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Account Providers"],
    summary: "List account providers",
    request: {
      query: ListProvidersQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedAccountProvidersSchema,
          },
        },
        description: "Paginated list of account providers",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ accounts: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Account Providers"],
    summary: "Create a new account provider",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateProviderInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: AccountProviderSchema,
          },
        },
        description: "Account provider created",
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
    middleware: [requirePermission({ accounts: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Account Providers"],
    summary: "Get an account provider by ID",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: AccountProviderSchema,
          },
        },
        description: "Account provider found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Account provider not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ accounts: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Account Providers"],
    summary: "Update an account provider",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateProviderInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: AccountProviderSchema,
          },
        },
        description: "Account provider updated",
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
        description: "Account provider not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ accounts: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Account Providers"],
    summary: "Delete an account provider",
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
        description: "Account provider deleted",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Account provider not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Account provider is in use",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.accountService.listProviders(query);
      return c.json(result, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      try {
        const provider = await ctx.accountService.createProvider(input);
        return c.json(provider, 201);
      } catch (err) {
        if (err instanceof ValidationError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      try {
        const provider = await ctx.accountService.getProvider(id);
        return c.json(provider, 200);
      } catch (err) {
        if (err instanceof AccountProviderNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        const provider = await ctx.accountService.updateProvider(id, input);
        return c.json(provider, 200);
      } catch (err) {
        if (err instanceof AccountProviderNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof ValidationError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");
      try {
        await ctx.accountService.deleteProvider(id);
        return c.json({ deleted: true }, 200);
      } catch (err) {
        if (err instanceof AccountProviderNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof AccountProviderInUseError) {
          return c.json({ error: err.message }, 409);
        }
        throw err;
      }
    });
}

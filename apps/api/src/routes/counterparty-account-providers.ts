import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  CounterpartyAccountProviderSchema,
  AccountProviderNotFoundError,
  AccountProviderInUseError,
  ValidationError,
  CreateProviderInputSchema,
  UpdateProviderInputSchema,
  ListProvidersQuerySchema,
} from "@bedrock/core/counterparty-accounts";
import {
  CounterpartyAccountProviderOptionSchema,
  CounterpartyAccountProviderOptionsResponseSchema,
} from "@bedrock/core/counterparty-accounts/contracts";
import { createPaginatedListSchema } from "@bedrock/kernel/pagination";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedCounterpartyAccountProvidersSchema = createPaginatedListSchema(
  CounterpartyAccountProviderSchema,
);

export function counterpartyAccountProvidersRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ counterparty_accounts: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Counterparty Account Providers"],
    summary: "List counterparty account providers",
    request: {
      query: ListProvidersQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedCounterpartyAccountProvidersSchema,
          },
        },
        description: "Paginated list of counterparty account providers",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ counterparty_accounts: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Counterparty Account Providers"],
    summary: "Create a new counterparty account provider",
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
            schema: CounterpartyAccountProviderSchema,
          },
        },
        description: "Counterparty account provider created",
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

  const optionsRoute = createRoute({
    middleware: [requirePermission({ counterparty_accounts: ["list"] })],
    method: "get",
    path: "/options",
    tags: ["Counterparty Account Providers"],
    summary: "List counterparty account providers for select inputs",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CounterpartyAccountProviderOptionsResponseSchema,
          },
        },
        description: "Counterparty account provider option list",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ counterparty_accounts: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Counterparty Account Providers"],
    summary: "Get a counterparty account provider by ID",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CounterpartyAccountProviderSchema,
          },
        },
        description: "Counterparty account provider found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Counterparty account provider not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ counterparty_accounts: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Counterparty Account Providers"],
    summary: "Update a counterparty account provider",
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
            schema: CounterpartyAccountProviderSchema,
          },
        },
        description: "Counterparty account provider updated",
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
        description: "Counterparty account provider not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ counterparty_accounts: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Counterparty Account Providers"],
    summary: "Delete a counterparty account provider",
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
        description: "Counterparty account provider deleted",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Counterparty account provider not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Counterparty account provider is in use",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.counterpartyAccountsService.listProviders(query);
      return c.json(result, 200);
    })
    .openapi(optionsRoute, async (c) => {
      const result = await ctx.counterpartyAccountsService.listProviders({
        limit: 200,
        offset: 0,
        sortBy: "name",
        sortOrder: "asc",
      });

      return c.json(
        {
          data: result.data.map((provider) =>
            CounterpartyAccountProviderOptionSchema.parse({
              id: provider.id,
              name: provider.name,
              type: provider.type,
              country: provider.country,
              label: `${provider.name} - ${provider.country}`,
            }),
          ),
        },
        200,
      );
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      try {
        const provider = await ctx.counterpartyAccountsService.createProvider(input);
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
        const provider = await ctx.counterpartyAccountsService.getProvider(id);
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
        const provider = await ctx.counterpartyAccountsService.updateProvider(id, input);
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
        await ctx.counterpartyAccountsService.deleteProvider(id);
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

import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import { createPaginatedListSchema } from "@bedrock/foundation/kernel/pagination";
import {
  AccountSchema,
  AccountNotFoundError,
  AccountProviderNotFoundError,
  ValidationError,
  CreateAccountInputSchema,
  UpdateAccountInputSchema,
  ListAccountsQuerySchema,
} from "@bedrock/operational-accounts";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedAccountsSchema = createPaginatedListSchema(AccountSchema);

export function accountsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ accounts: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Accounts"],
    summary: "List accounts",
    request: {
      query: ListAccountsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedAccountsSchema,
          },
        },
        description: "Paginated list of accounts",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ accounts: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Accounts"],
    summary: "Create a new account",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateAccountInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: AccountSchema,
          },
        },
        description: "Account created",
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
        description: "Referenced provider not found",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ accounts: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Accounts"],
    summary: "Get an account by ID",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: AccountSchema,
          },
        },
        description: "Account found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Account not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ accounts: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Accounts"],
    summary: "Update an account",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateAccountInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: AccountSchema,
          },
        },
        description: "Account updated",
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
        description: "Account or provider not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ accounts: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Accounts"],
    summary: "Delete an account",
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
        description: "Account deleted",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Account not found",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.operationalAccountsService.listAccounts(query);
      return c.json(result, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      try {
        const account = await ctx.operationalAccountsService.createAccount(input);
        return c.json(account, 201);
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
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      try {
        const account = await ctx.operationalAccountsService.getAccount(id);
        return c.json(account, 200);
      } catch (err) {
        if (err instanceof AccountNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        const account = await ctx.operationalAccountsService.updateAccount(id, input);
        return c.json(account, 200);
      } catch (err) {
        if (
          err instanceof AccountNotFoundError ||
          err instanceof AccountProviderNotFoundError
        ) {
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
        await ctx.operationalAccountsService.deleteAccount(id);
        return c.json({ deleted: true }, 200);
      } catch (err) {
        if (err instanceof AccountNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    });
}

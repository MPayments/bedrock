import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import { createPaginatedListSchema } from "@bedrock/kernel/pagination";
import {
  CounterpartyAccountSchema,
  AccountNotFoundError,
  AccountProviderNotFoundError,
  ValidationError,
  CreateAccountInputSchema,
  UpdateAccountInputSchema,
  ListAccountsQuerySchema,
} from "@bedrock/core/counterparty-accounts";
import {
  CounterpartyNotInternalLedgerEntityError,
  InternalLedgerInvariantViolationError,
} from "@bedrock/core/counterparties";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedCounterpartyAccountsSchema = createPaginatedListSchema(
  CounterpartyAccountSchema,
);

export function counterpartyAccountsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ counterparty_accounts: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Counterparty Accounts"],
    summary: "List counterparty accounts",
    request: {
      query: ListAccountsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedCounterpartyAccountsSchema,
          },
        },
        description: "Paginated list of counterparty accounts",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ counterparty_accounts: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Counterparty Accounts"],
    summary: "Create a new counterparty account",
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
            schema: CounterpartyAccountSchema,
          },
        },
        description: "Counterparty account created",
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
    middleware: [requirePermission({ counterparty_accounts: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Counterparty Accounts"],
    summary: "Get a counterparty account by ID",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CounterpartyAccountSchema,
          },
        },
        description: "Counterparty account found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Counterparty account not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ counterparty_accounts: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Counterparty Accounts"],
    summary: "Update a counterparty account",
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
            schema: CounterpartyAccountSchema,
          },
        },
        description: "Counterparty account updated",
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
        description: "Counterparty account or provider not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ counterparty_accounts: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Counterparty Accounts"],
    summary: "Delete a counterparty account",
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
        description: "Counterparty account deleted",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Counterparty account not found",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.counterpartyAccountsService.listAccounts(query);
      return c.json(result, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      try {
        const counterpartyAccount =
          await ctx.counterpartyAccountsService.createAccount(input);
        return c.json(counterpartyAccount, 201);
      } catch (err) {
        if (err instanceof AccountProviderNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof CounterpartyNotInternalLedgerEntityError) {
          return c.json({ error: err.message }, 400);
        }
        if (err instanceof InternalLedgerInvariantViolationError) {
          return c.json({ error: err.message }, 400);
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
        const counterpartyAccount = await ctx.counterpartyAccountsService.getAccount(id);
        return c.json(counterpartyAccount, 200);
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
        const counterpartyAccount =
          await ctx.counterpartyAccountsService.updateAccount(id, input);
        return c.json(counterpartyAccount, 200);
      } catch (err) {
        if (
          err instanceof AccountNotFoundError ||
          err instanceof AccountProviderNotFoundError
        ) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof CounterpartyNotInternalLedgerEntityError) {
          return c.json({ error: err.message }, 400);
        }
        if (err instanceof InternalLedgerInvariantViolationError) {
          return c.json({ error: err.message }, 400);
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
        await ctx.counterpartyAccountsService.deleteAccount(id);
        return c.json({ deleted: true }, 200);
      } catch (err) {
        if (err instanceof AccountNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    });
}

import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  CounterpartyCustomerNotFoundError,
  CounterpartyNotFoundError,
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
  CounterpartySchema,
  CreateCounterpartyInputSchema,
  ListCounterpartiesQuerySchema,
  UpdateCounterpartyInputSchema,
} from "@bedrock/counterparties";
import {
  CounterpartyOptionSchema,
  CounterpartyOptionsResponseSchema,
} from "@bedrock/counterparties/contracts";
import { createPaginatedListSchema } from "@bedrock/kernel/pagination";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedCounterpartiesSchema =
  createPaginatedListSchema(CounterpartySchema);

export function counterpartiesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Counterparties"],
    summary: "List counterparties",
    request: {
      query: ListCounterpartiesQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedCounterpartiesSchema,
          },
        },
        description: "Paginated list of counterparties",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ counterparties: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Counterparties"],
    summary: "Create a new counterparty",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateCounterpartyInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: CounterpartySchema,
          },
        },
        description: "Counterparty created",
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
        description: "Referenced group not found",
      },
    },
  });

  const optionsRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/options",
    tags: ["Counterparties"],
    summary: "List counterparties for select inputs",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CounterpartyOptionsResponseSchema,
          },
        },
        description: "Counterparty option list",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Counterparties"],
    summary: "Get a counterparty by ID",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CounterpartySchema,
          },
        },
        description: "Counterparty found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Counterparty not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Counterparties"],
    summary: "Update a counterparty",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateCounterpartyInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CounterpartySchema,
          },
        },
        description: "Counterparty updated",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Counterparty not found",
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

  const deleteRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Counterparties"],
    summary: "Delete a counterparty",
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
        description: "Counterparty deleted",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Counterparty not found",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.counterpartiesService.list(query);
      return c.json(result, 200);
    })
    .openapi(optionsRoute, async (c) => {
      const result = await ctx.counterpartiesService.list({
        limit: 500,
        offset: 0,
        sortBy: "shortName",
        sortOrder: "asc",
      });

      return c.json(
        {
          data: result.data.map((counterparty) =>
            CounterpartyOptionSchema.parse({
              id: counterparty.id,
              shortName: counterparty.shortName,
              label: counterparty.shortName,
            }),
          ),
        },
        200,
      );
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      try {
        const counterparty = await ctx.counterpartiesService.create(input);
        return c.json(counterparty, 201);
      } catch (err) {
        if (
          err instanceof CounterpartyGroupNotFoundError ||
          err instanceof CounterpartyCustomerNotFoundError
        ) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof CounterpartyGroupRuleError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      try {
        const counterparty = await ctx.counterpartiesService.findById(id);
        return c.json(counterparty, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        const counterparty = await ctx.counterpartiesService.update(id, input);
        return c.json(counterparty, 200);
      } catch (err) {
        if (
          err instanceof CounterpartyNotFoundError ||
          err instanceof CounterpartyGroupNotFoundError ||
          err instanceof CounterpartyCustomerNotFoundError
        ) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof CounterpartyGroupRuleError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");
      try {
        await ctx.counterpartiesService.remove(id);
        return c.json({ deleted: true }, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    });
}

import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  CounterpartyRequisiteNotFoundError,
  CounterpartyRequisiteOwnerInternalError,
  CounterpartyRequisiteSchema,
  CreateCounterpartyRequisiteInputSchema,
  ListCounterpartyRequisitesQuerySchema,
  UpdateCounterpartyRequisiteInputSchema,
  ValidationError,
} from "@bedrock/core/counterparty-requisites";
import {
  CounterpartyRequisiteOptionSchema,
  CounterpartyRequisiteOptionsResponseSchema,
} from "@bedrock/core/counterparty-requisites/contracts";
import { createPaginatedListSchema } from "@bedrock/kernel/pagination";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import { buildOptionsResponse } from "../common/options";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedCounterpartyRequisitesSchema = createPaginatedListSchema(
  CounterpartyRequisiteSchema,
);

export function counterpartyRequisitesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ counterparty_requisites: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Counterparty Requisites"],
    summary: "List counterparty requisites",
    request: {
      query: ListCounterpartyRequisitesQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedCounterpartyRequisitesSchema,
          },
        },
        description: "Paginated list of counterparty requisites",
      },
    },
  });

  const optionsRoute = createRoute({
    middleware: [requirePermission({ counterparty_requisites: ["list"] })],
    method: "get",
    path: "/options",
    tags: ["Counterparty Requisites"],
    summary: "List counterparty requisite options",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CounterpartyRequisiteOptionsResponseSchema,
          },
        },
        description: "Counterparty requisite option list",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ counterparty_requisites: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Counterparty Requisites"],
    summary: "Create a new counterparty requisite",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateCounterpartyRequisiteInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: CounterpartyRequisiteSchema,
          },
        },
        description: "Counterparty requisite created",
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
    middleware: [requirePermission({ counterparty_requisites: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Counterparty Requisites"],
    summary: "Get a counterparty requisite by ID",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CounterpartyRequisiteSchema,
          },
        },
        description: "Counterparty requisite found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Counterparty requisite not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ counterparty_requisites: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Counterparty Requisites"],
    summary: "Update a counterparty requisite",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateCounterpartyRequisiteInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CounterpartyRequisiteSchema,
          },
        },
        description: "Counterparty requisite updated",
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
        description: "Counterparty requisite not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ counterparty_requisites: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Counterparty Requisites"],
    summary: "Archive a counterparty requisite",
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
        description: "Counterparty requisite archived",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Counterparty requisite not found",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.counterpartyRequisitesService.list(query);
      return c.json(result, 200);
    })
    .openapi(optionsRoute, async (c) => {
      const query = c.req.query("counterpartyId")
        ? { counterpartyId: c.req.query("counterpartyId") }
        : undefined;
      const result = await ctx.counterpartyRequisitesService.listOptions(query);

      return c.json(
        buildOptionsResponse(result, (item) =>
          CounterpartyRequisiteOptionSchema.parse(item),
        ),
        200,
      );
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");

      try {
        const requisite = await ctx.counterpartyRequisitesService.create(input);
        return c.json(requisite, 201);
      } catch (err) {
        if (
          err instanceof CounterpartyRequisiteOwnerInternalError ||
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
        const requisite = await ctx.counterpartyRequisitesService.findById(id);
        return c.json(requisite, 200);
      } catch (err) {
        if (err instanceof CounterpartyRequisiteNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const requisite = await ctx.counterpartyRequisitesService.update(
          id,
          input,
        );
        return c.json(requisite, 200);
      } catch (err) {
        if (err instanceof CounterpartyRequisiteNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (
          err instanceof CounterpartyRequisiteOwnerInternalError ||
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
        await ctx.counterpartyRequisitesService.remove(id);
        return c.json({ deleted: true }, 200);
      } catch (err) {
        if (err instanceof CounterpartyRequisiteNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    });
}

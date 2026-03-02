import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  CustomerDeleteConflictError,
  CustomerNotFoundError,
  CustomerSchema,
  CreateCustomerInputSchema,
  ListCustomersQuerySchema,
  UpdateCustomerInputSchema,
} from "@bedrock/customers";
import { createPaginatedListSchema } from "@bedrock/foundation/kernel/pagination";

import { DeletedSchema, ErrorSchema, IdParamSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedCustomersSchema = createPaginatedListSchema(CustomerSchema);

export function customersRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Customers"],
    summary: "List customers",
    request: {
      query: ListCustomersQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedCustomersSchema,
          },
        },
        description: "Paginated list of customers",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ customers: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Customers"],
    summary: "Create a new customer",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateCustomerInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: CustomerSchema,
          },
        },
        description: "Customer created",
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
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Customers"],
    summary: "Get a customer by ID",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CustomerSchema,
          },
        },
        description: "Customer found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Customer not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ customers: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Customers"],
    summary: "Update a customer",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateCustomerInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CustomerSchema,
          },
        },
        description: "Customer updated",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Customer not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ customers: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Customers"],
    summary: "Delete a customer",
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
        description: "Customer deleted",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Customer not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Customer is referenced by payment orders",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.customersService.list(query);
      return c.json(result, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const customer = await ctx.customersService.create(input);
      return c.json(customer, 201);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const customer = await ctx.customersService.findById(id);
        return c.json(customer, 200);
      } catch (error) {
        if (error instanceof CustomerNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const customer = await ctx.customersService.update(id, input);
        return c.json(customer, 200);
      } catch (error) {
        if (error instanceof CustomerNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        await ctx.customersService.remove(id);
        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (error instanceof CustomerNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        if (error instanceof CustomerDeleteConflictError) {
          return c.json({ error: error.message }, 409);
        }

        throw error;
      }
    });
}

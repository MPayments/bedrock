import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { AppError } from "@repo/kernel";
import {
  CustomerSchema,
  CreateCustomerInputSchema,
  UpdateCustomerInputSchema,
  ListCustomersQuerySchema,
  CustomerIdParamSchema,
} from "@repo/customers";
import type { AppContext } from "../context";
import { ErrorSchema, DeletedSchema } from "../common.js";

export function customersRoutes(ctx: AppContext) {
  const app = new OpenAPIHono();

  // List customers
  const list = createRoute({
    method: "get",
    path: "/",
    tags: ["Customers"],
    summary: "List customers",
    description: "List all customers, optionally filtered by organization",
    request: {
      query: ListCustomersQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(CustomerSchema),
          },
        },
        description: "List of customers",
      },
    },
  });

  // Create customer
  const create = createRoute({
    method: "post",
    path: "/",
    tags: ["Customers"],
    summary: "Create a new customer",
    description: "Creates a customer and ensures their ledger account exists",
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

  // Get customer by ID
  const one = createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Customers"],
    summary: "Get a customer by ID",
    request: {
      params: CustomerIdParamSchema,
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

  // Update customer
  const update = createRoute({
    method: "patch",
    path: "/{id}",
    tags: ["Customers"],
    summary: "Update a customer",
    request: {
      params: CustomerIdParamSchema,
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

  // Delete customer
  const del = createRoute({
    method: "delete",
    path: "/{id}",
    tags: ["Customers"],
    summary: "Delete a customer",
    description: "Deletes the customer. Note: The ledger account is not deleted (immutable).",
    request: {
      params: CustomerIdParamSchema,
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
    },
  });

  // Register routes
  return app
    .openapi(list, async (c) => {
      const query = c.req.valid("query");
      const customers = await ctx.customers.list(query);
      return c.json(customers, 200);
    })
    .openapi(create, async (c) => {
      const input = c.req.valid("json");
      const customer = await ctx.customers.create(input);
      return c.json(customer, 201);
    })
    .openapi(one, async (c) => {
      const { id } = c.req.valid("param");
      const customer = await ctx.customers.findById(id);
      if (!customer) {
        return c.json({ error: "Customer not found" }, 404);
      }
      return c.json(customer, 200);
    })
    .openapi(update, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        const customer = await ctx.customers.update(id, input);
        return c.json(customer, 200);
      } catch (err) {
        if (AppError.is(err, "CUSTOMER_NOT_FOUND")) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(del, async (c) => {
      const { id } = c.req.valid("param");
      try {
        await ctx.customers.delete(id);
        return c.json({ deleted: true }, 200);
      } catch (err) {
        if (AppError.is(err, "CUSTOMER_NOT_FOUND")) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    });
}

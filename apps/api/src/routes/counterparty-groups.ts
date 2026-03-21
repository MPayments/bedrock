import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  CounterpartyCustomerNotFoundError,
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
  CounterpartySystemGroupDeleteError,
} from "@bedrock/parties";
import {
  CounterpartyGroupSchema,
  CreateCounterpartyGroupInputSchema,
  ListCounterpartyGroupsQuerySchema,
  UpdateCounterpartyGroupInputSchema,
} from "@bedrock/parties/contracts";
import {
  CounterpartyGroupOptionSchema,
  CounterpartyGroupOptionsResponseSchema,
} from "@bedrock/parties/contracts";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import { buildOptionsResponse } from "../common/options";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

function buildCounterpartyGroupOptionLabel(group: {
  name: string;
  customerLabel?: string | null;
}) {
  const name = group.name.trim();
  const customerLabel = group.customerLabel?.trim();

  if (customerLabel && customerLabel.length > 0 && customerLabel !== name) {
    return `${name} · ${customerLabel}`;
  }

  return name;
}

export function counterpartyGroupsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Counterparty Groups"],
    summary: "List counterparty groups",
    request: {
      query: ListCounterpartyGroupsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CounterpartyGroupSchema.array(),
          },
        },
        description: "List of counterparty groups",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ counterparties: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Counterparty Groups"],
    summary: "Create a counterparty group",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateCounterpartyGroupInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: CounterpartyGroupSchema,
          },
        },
        description: "Counterparty group created",
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
        description: "Parent group or customer not found",
      },
    },
  });

  const optionsRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/options",
    tags: ["Counterparty Groups"],
    summary: "List counterparty groups for select inputs",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CounterpartyGroupOptionsResponseSchema,
          },
        },
        description: "Counterparty group option list",
      },
    },
  });

  const _getRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Counterparty Groups"],
    summary: "Get a counterparty group by ID",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CounterpartyGroupSchema,
          },
        },
        description: "Counterparty group found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Parent group not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Counterparty Groups"],
    summary: "Update a counterparty group",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateCounterpartyGroupInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CounterpartyGroupSchema,
          },
        },
        description: "Counterparty group updated",
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
        description: "Counterparty group not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Counterparty Groups"],
    summary: "Delete a counterparty group",
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
        description: "Counterparty group deleted",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "System group cannot be deleted",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Counterparty group not found",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const groups = await ctx.partiesModule.counterparties.queries.listGroups(
        query,
      );
      return c.json(groups, 200);
    })
    .openapi(optionsRoute, async (c) => {
      const groups = await ctx.partiesModule.counterparties.queries.listGroups({
        includeSystem: true,
      });

      return c.json(
        buildOptionsResponse(groups, (group) =>
          CounterpartyGroupOptionSchema.parse({
            id: group.id,
            code: group.code,
            name: group.name,
            parentId: group.parentId,
            customerId: group.customerId,
            customerLabel: group.customerLabel ?? null,
            isSystem: group.isSystem,
            label: buildCounterpartyGroupOptionLabel(group),
          }),
        ),
        200,
      );
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");

      try {
        const group =
          await ctx.partiesModule.counterparties.commands.createGroup(input);
        return c.json(group, 201);
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
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const group = await ctx.partiesModule.counterparties.commands.updateGroup(
          id,
          input,
        );
        return c.json(group, 200);
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
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        await ctx.partiesModule.counterparties.commands.removeGroup(id);
        return c.json({ deleted: true }, 200);
      } catch (err) {
        if (err instanceof CounterpartyGroupNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof CounterpartySystemGroupDeleteError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    });
}

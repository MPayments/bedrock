import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  CounterpartyCustomerNotFoundError,
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
  CounterpartyNotFoundError,
  RequisiteProviderNotActiveError,
} from "@bedrock/parties";
import {
  CounterpartySchema,
  CreateCounterpartyInputSchema,
  CreateRequisiteInputSchema,
  ListCounterpartiesQuerySchema,
  ListRequisitesQuerySchema,
  PartyProfileBundleInputSchema,
  PartyProfileBundleSchema,
  PaginatedCounterpartiesSchema,
  RequisiteListItemSchema,
  RequisiteSchema,
  SubAgentProfileSchema,
  UpdateCounterpartyInputSchema,
} from "@bedrock/parties/contracts";
import {
  CounterpartyOptionSchema,
  CounterpartyOptionsResponseSchema,
} from "@bedrock/parties/contracts";
import {
  createPaginatedListSchema,
  MAX_QUERY_LIST_LIMIT,
} from "@bedrock/shared/core/pagination";
import { ValidationError } from "@bedrock/shared/core/errors";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import { buildOptionsResponse } from "../common/options";
import type { AppContext } from "../context";
import {
  mapPartyProfileMutationError,
  replacePartyProfileBundle,
} from "./party-profile";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const CounterpartyRequisitesQuerySchema = ListRequisitesQuerySchema.omit({
  ownerId: true,
  ownerType: true,
});
const CreateCounterpartyRequisiteInputSchema = CreateRequisiteInputSchema.omit({
  ownerId: true,
  ownerType: true,
});
const PaginatedCounterpartyRequisitesSchema = createPaginatedListSchema(
  RequisiteListItemSchema,
);
const CounterpartyAssignmentSchema = z.object({
  counterpartyId: z.uuid(),
  subAgent: SubAgentProfileSchema.nullable(),
  subAgentCounterpartyId: z.uuid().nullable(),
});
const UpdateCounterpartyAssignmentInputSchema = z.object({
  subAgentCounterpartyId: z.uuid().nullable(),
});

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

  const listRequisitesRoute = createRoute({
    middleware: [requirePermission({ requisites: ["list"] })],
    method: "get",
    path: "/{id}/requisites",
    tags: ["Counterparties"],
    summary: "List counterparty requisites",
    request: {
      params: IdParamSchema,
      query: CounterpartyRequisitesQuerySchema,
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
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Counterparty not found",
      },
    },
  });

  const createRequisiteRoute = createRoute({
    middleware: [requirePermission({ requisites: ["create"] })],
    method: "post",
    path: "/{id}/requisites",
    tags: ["Counterparties"],
    summary: "Create counterparty requisite",
    request: {
      params: IdParamSchema,
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
            schema: RequisiteSchema,
          },
        },
        description: "Counterparty requisite created",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Counterparty not found",
      },
    },
  });

  const putPartyProfileRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["update"] })],
    method: "put",
    path: "/{id}/party-profile",
    tags: ["Counterparties"],
    summary: "Replace counterparty party profile data",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": { schema: PartyProfileBundleInputSchema },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: PartyProfileBundleSchema },
        },
        description: "Counterparty party profile bundle updated",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Counterparty not found",
      },
    },
  });

  const getAssignmentRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/{id}/assignment",
    tags: ["Counterparties"],
    summary: "Get customer-owned counterparty assignment",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: CounterpartyAssignmentSchema },
        },
        description: "Counterparty assignment",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Counterparty not found",
      },
    },
  });

  const updateAssignmentRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["update"] })],
    method: "patch",
    path: "/{id}/assignment",
    tags: ["Counterparties"],
    summary: "Update customer-owned counterparty assignment",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateCounterpartyAssignmentInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: CounterpartyAssignmentSchema },
        },
        description: "Counterparty assignment updated",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Counterparty not found",
      },
    },
  });

  async function ensureCounterpartyExists(id: string) {
    await ctx.partiesModule.counterparties.queries.findById(id);
  }

  async function resolveAssignment(counterpartyId: string) {
    const assignment =
      (
        await ctx.partiesReadRuntime.counterpartiesQueries.listAssignmentsByCounterpartyIds(
          [counterpartyId],
        )
      ).get(counterpartyId) ?? null;
    const subAgent = assignment?.subAgentCounterpartyId
      ? await ctx.partiesModule.subAgentProfiles.queries.findById(
          assignment.subAgentCounterpartyId,
        )
      : null;

    return {
      counterpartyId,
      subAgent,
      subAgentCounterpartyId: assignment?.subAgentCounterpartyId ?? null,
    };
  }

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.partiesModule.counterparties.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(optionsRoute, async (c) => {
      const result = await ctx.partiesModule.counterparties.queries.list({
        limit: MAX_QUERY_LIST_LIMIT,
        offset: 0,
        sortBy: "shortName",
        sortOrder: "asc",
      });

      return c.json(
        buildOptionsResponse(result, (counterparty) =>
          CounterpartyOptionSchema.parse({
            id: counterparty.id,
            shortName: counterparty.shortName,
            label: counterparty.shortName,
          }),
        ),
        200,
      );
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      try {
        const counterparty =
          await ctx.partiesModule.counterparties.commands.create(input);
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
        const counterparty =
          await ctx.partiesModule.counterparties.queries.findById(id);
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
        const counterparty =
          await ctx.partiesModule.counterparties.commands.update(id, input);
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
        await ctx.partiesModule.counterparties.commands.remove(id);
        return c.json({ deleted: true }, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(listRequisitesRoute, async (c) => {
      const { id } = c.req.valid("param");
      const query = c.req.valid("query");
      try {
        await ensureCounterpartyExists(id);
        const result = await ctx.partiesModule.requisites.queries.list({
          ...query,
          ownerId: id,
          ownerType: "counterparty",
        });
        return c.json(result, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(createRequisiteRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        await ensureCounterpartyExists(id);
        const requisite = await ctx.partiesModule.requisites.commands.create({
          ...input,
          ownerId: id,
          ownerType: "counterparty",
        });
        return c.json(requisite, 201);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (
          err instanceof ValidationError ||
          err instanceof RequisiteProviderNotActiveError
        ) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    })
    .openapi(putPartyProfileRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        const counterparty =
          await ctx.partiesModule.counterparties.queries.findById(id);
        const bundle = await replacePartyProfileBundle({
          bundle: input,
          ctx,
          ownerId: id,
          ownerType: "counterparty",
          party: counterparty,
        });
        return c.json(bundle, 200);
      } catch (err) {
        const handled = mapPartyProfileMutationError(
          err,
          CounterpartyNotFoundError,
        );
        if (handled) {
          return c.json(handled.body, handled.status);
        }
        throw err;
      }
    })
    .openapi(getAssignmentRoute, async (c) => {
      const { id } = c.req.valid("param");
      try {
        await ensureCounterpartyExists(id);
        return c.json(await resolveAssignment(id), 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(updateAssignmentRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        await ensureCounterpartyExists(id);
        await ctx.partiesReadRuntime.counterpartiesQueries.upsertAssignment({
          counterpartyId: id,
          subAgentCounterpartyId: input.subAgentCounterpartyId,
        });
        return c.json(await resolveAssignment(id), 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    });
}

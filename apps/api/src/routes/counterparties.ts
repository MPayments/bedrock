import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

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
  PartyAddressInputSchema,
  PartyAddressSchema,
  PartyContactInputSchema,
  PartyContactSchema,
  PartyLegalIdentifierInputSchema,
  PartyLegalIdentifierSchema,
  PartyLegalProfileInputSchema,
  PartyLegalProfileSchema,
  PartyLicenseInputSchema,
  PartyLicenseSchema,
  PartyRepresentativeInputSchema,
  PartyRepresentativeSchema,
  PaginatedCounterpartiesSchema,
  RequisiteListItemSchema,
  RequisiteSchema,
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

  const getLegalProfileRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/{id}/legal-profile",
    tags: ["Counterparties"],
    summary: "Get counterparty legal profile",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PartyLegalProfileSchema.nullable() },
        },
        description: "Counterparty legal profile",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
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

  const putLegalProfileRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["update"] })],
    method: "put",
    path: "/{id}/legal-profile",
    tags: ["Counterparties"],
    summary: "Replace counterparty legal profile",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": { schema: PartyLegalProfileInputSchema },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: PartyLegalProfileSchema },
        },
        description: "Counterparty legal profile updated",
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

  const getIdentifiersRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/{id}/identifiers",
    tags: ["Counterparties"],
    summary: "List counterparty legal identifiers",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PartyLegalIdentifierSchema.array() },
        },
        description: "Counterparty legal identifiers",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Counterparty not found",
      },
    },
  });

  const putIdentifiersRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["update"] })],
    method: "put",
    path: "/{id}/identifiers",
    tags: ["Counterparties"],
    summary: "Replace counterparty legal identifiers",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": { schema: PartyLegalIdentifierInputSchema.array() },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: PartyLegalIdentifierSchema.array() },
        },
        description: "Counterparty legal identifiers updated",
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

  const getAddressesRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/{id}/addresses",
    tags: ["Counterparties"],
    summary: "List counterparty addresses",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: PartyAddressSchema.array() } },
        description: "Counterparty addresses",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Counterparty not found",
      },
    },
  });

  const putAddressesRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["update"] })],
    method: "put",
    path: "/{id}/addresses",
    tags: ["Counterparties"],
    summary: "Replace counterparty addresses",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": { schema: PartyAddressInputSchema.array() },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: PartyAddressSchema.array() } },
        description: "Counterparty addresses updated",
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

  const getContactsRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/{id}/contacts",
    tags: ["Counterparties"],
    summary: "List counterparty contacts",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: PartyContactSchema.array() } },
        description: "Counterparty contacts",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Counterparty not found",
      },
    },
  });

  const putContactsRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["update"] })],
    method: "put",
    path: "/{id}/contacts",
    tags: ["Counterparties"],
    summary: "Replace counterparty contacts",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": { schema: PartyContactInputSchema.array() },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: PartyContactSchema.array() } },
        description: "Counterparty contacts updated",
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

  const getRepresentativesRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/{id}/representatives",
    tags: ["Counterparties"],
    summary: "List counterparty representatives",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PartyRepresentativeSchema.array() },
        },
        description: "Counterparty representatives",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Counterparty not found",
      },
    },
  });

  const putRepresentativesRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["update"] })],
    method: "put",
    path: "/{id}/representatives",
    tags: ["Counterparties"],
    summary: "Replace counterparty representatives",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": { schema: PartyRepresentativeInputSchema.array() },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: PartyRepresentativeSchema.array() },
        },
        description: "Counterparty representatives updated",
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

  const getLicensesRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["list"] })],
    method: "get",
    path: "/{id}/licenses",
    tags: ["Counterparties"],
    summary: "List counterparty licenses",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: PartyLicenseSchema.array() } },
        description: "Counterparty licenses",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Counterparty not found",
      },
    },
  });

  const putLicensesRoute = createRoute({
    middleware: [requirePermission({ counterparties: ["update"] })],
    method: "put",
    path: "/{id}/licenses",
    tags: ["Counterparties"],
    summary: "Replace counterparty licenses",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": { schema: PartyLicenseInputSchema.array() },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: PartyLicenseSchema.array() } },
        description: "Counterparty licenses updated",
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

  async function ensureCounterpartyExists(id: string) {
    await ctx.partiesModule.counterparties.queries.findById(id);
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
    .openapi(getLegalProfileRoute, async (c) => {
      const { id } = c.req.valid("param");
      try {
        await ensureCounterpartyExists(id);
        const profile =
          await ctx.partiesModule.legalEntities.queries.findProfileByOwner({
            ownerType: "counterparty",
            ownerId: id,
          });
        return c.json(profile, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(putLegalProfileRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        await ensureCounterpartyExists(id);
        const profile = await ctx.partiesModule.legalEntities.commands.upsertProfile({
          ownerType: "counterparty",
          ownerId: id,
          profile: input,
        });
        return c.json(profile, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof ValidationError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    })
    .openapi(getIdentifiersRoute, async (c) => {
      const { id } = c.req.valid("param");
      try {
        await ensureCounterpartyExists(id);
        const identifiers =
          await ctx.partiesModule.legalEntities.queries.listIdentifiersByOwner({
            ownerType: "counterparty",
            ownerId: id,
          });
        return c.json(identifiers, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(putIdentifiersRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        await ensureCounterpartyExists(id);
        const identifiers =
          await ctx.partiesModule.legalEntities.commands.replaceIdentifiers({
            ownerType: "counterparty",
            ownerId: id,
            items: input,
          });
        return c.json(identifiers, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof ValidationError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    })
    .openapi(getAddressesRoute, async (c) => {
      const { id } = c.req.valid("param");
      try {
        await ensureCounterpartyExists(id);
        const addresses =
          await ctx.partiesModule.legalEntities.queries.listAddressesByOwner({
            ownerType: "counterparty",
            ownerId: id,
          });
        return c.json(addresses, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(putAddressesRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        await ensureCounterpartyExists(id);
        const addresses =
          await ctx.partiesModule.legalEntities.commands.replaceAddresses({
            ownerType: "counterparty",
            ownerId: id,
            items: input,
          });
        return c.json(addresses, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof ValidationError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    })
    .openapi(getContactsRoute, async (c) => {
      const { id } = c.req.valid("param");
      try {
        await ensureCounterpartyExists(id);
        const contacts =
          await ctx.partiesModule.legalEntities.queries.listContactsByOwner({
            ownerType: "counterparty",
            ownerId: id,
          });
        return c.json(contacts, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(putContactsRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        await ensureCounterpartyExists(id);
        const contacts =
          await ctx.partiesModule.legalEntities.commands.replaceContacts({
            ownerType: "counterparty",
            ownerId: id,
            items: input,
          });
        return c.json(contacts, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof ValidationError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    })
    .openapi(getRepresentativesRoute, async (c) => {
      const { id } = c.req.valid("param");
      try {
        await ensureCounterpartyExists(id);
        const representatives =
          await ctx.partiesModule.legalEntities.queries.listRepresentativesByOwner({
            ownerType: "counterparty",
            ownerId: id,
          });
        return c.json(representatives, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(putRepresentativesRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        await ensureCounterpartyExists(id);
        const representatives =
          await ctx.partiesModule.legalEntities.commands.replaceRepresentatives({
            ownerType: "counterparty",
            ownerId: id,
            items: input,
          });
        return c.json(representatives, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof ValidationError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    })
    .openapi(getLicensesRoute, async (c) => {
      const { id } = c.req.valid("param");
      try {
        await ensureCounterpartyExists(id);
        const licenses =
          await ctx.partiesModule.legalEntities.queries.listLicensesByOwner({
            ownerType: "counterparty",
            ownerId: id,
          });
        return c.json(licenses, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(putLicensesRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        await ensureCounterpartyExists(id);
        const licenses =
          await ctx.partiesModule.legalEntities.commands.replaceLicenses({
            ownerType: "counterparty",
            ownerId: id,
            items: input,
          });
        return c.json(licenses, 200);
      } catch (err) {
        if (err instanceof CounterpartyNotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (err instanceof ValidationError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    });
}

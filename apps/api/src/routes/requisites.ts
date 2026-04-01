import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import { CurrencyNotFoundError } from "@bedrock/currencies";
import {
  CounterpartyNotFoundError,
  OrganizationNotFoundError,
} from "@bedrock/parties";
import {
  RequisiteAccountingBindingNotFoundError,
  RequisiteAccountingBindingOwnerTypeError,
  RequisiteNotFoundError,
  RequisiteProviderNotFoundError,
  RequisiteProviderNotActiveError,
} from "@bedrock/parties";
import {
  BankRequisiteWorkspaceResponseSchema,
  CreateRequisiteInputSchema,
  ListBankRequisiteWorkspaceQuerySchema,
  ListRequisiteOptionsQuerySchema,
  ListRequisitesQuerySchema,
  RequisiteAccountingBindingSchema,
  RequisiteOptionsResponseSchema,
  RequisiteOptionSchema,
  RequisiteProviderSchema,
  RequisiteSchema,
  UpdateRequisiteInputSchema,
  UpsertRequisiteAccountingBindingInputSchema,
} from "@bedrock/parties/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import { buildOptionsResponse } from "../common/options";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedRequisitesSchema = createPaginatedListSchema(RequisiteSchema);

async function findBankWorkspaceProvider(
  ctx: AppContext,
  providerId: string,
) {
  try {
    return await ctx.partiesModule.requisites.queries.findProviderById(
      providerId,
    );
  } catch (error) {
    if (error instanceof RequisiteProviderNotFoundError) {
      return null;
    }

    throw error;
  }
}

async function findBankWorkspaceCurrency(
  ctx: AppContext,
  currencyId: string,
) {
  try {
    return await ctx.currenciesService.findById(currencyId);
  } catch (error) {
    if (error instanceof CurrencyNotFoundError) {
      return null;
    }

    throw error;
  }
}

export function requisitesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ requisites: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Requisites"],
    summary: "List requisites",
    request: {
      query: ListRequisitesQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedRequisitesSchema,
          },
        },
        description: "Paginated list of requisites",
      },
    },
  });

  const optionsRoute = createRoute({
    middleware: [requirePermission({ requisites: ["list"] })],
    method: "get",
    path: "/options",
    tags: ["Requisites"],
    summary: "List requisite options",
    request: {
      query: ListRequisiteOptionsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteOptionsResponseSchema,
          },
        },
        description: "Requisite option list",
      },
    },
  });

  const bankWorkspaceRoute = createRoute({
    middleware: [requirePermission({ requisites: ["list"] })],
    method: "get",
    path: "/bank-workspace",
    tags: ["Requisites"],
    summary:
      "List active bank requisites for an owner with resolved provider and currency metadata",
    request: {
      query: ListBankRequisiteWorkspaceQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: BankRequisiteWorkspaceResponseSchema,
          },
        },
        description: "Bank requisites workspace data",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ requisites: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Requisites"],
    summary: "Create requisite",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateRequisiteInputSchema,
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
        description: "Requisite created",
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
        description: "Owner not found",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ requisites: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Requisites"],
    summary: "Get requisite by id",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteSchema,
          },
        },
        description: "Requisite found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Requisite not found",
      },
    },
  });

  const getProviderRoute = createRoute({
    middleware: [requirePermission({ requisites: ["list"] })],
    method: "get",
    path: "/{id}/provider",
    tags: ["Requisites"],
    summary: "Get resolved provider for a requisite",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteProviderSchema.nullable(),
          },
        },
        description: "Resolved requisite provider or null when the relation is dangling",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Requisite not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ requisites: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Requisites"],
    summary: "Update requisite",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateRequisiteInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteSchema,
          },
        },
        description: "Requisite updated",
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
        description: "Requisite not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ requisites: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Requisites"],
    summary: "Archive requisite",
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
        description: "Requisite archived",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Requisite not found",
      },
    },
  });

  const getBindingRoute = createRoute({
    middleware: [requirePermission({ requisites: ["list"] })],
    method: "get",
    path: "/{id}/binding",
    tags: ["Requisites"],
    summary: "Get requisite accounting binding",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteAccountingBindingSchema,
          },
        },
        description: "Requisite binding found",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Binding owner type is invalid",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Binding not found",
      },
    },
  });

  const upsertBindingRoute = createRoute({
    middleware: [requirePermission({ requisites: ["configure_binding"] })],
    method: "patch",
    path: "/{id}/binding",
    tags: ["Requisites"],
    summary: "Create or update requisite accounting binding",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpsertRequisiteAccountingBindingInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: RequisiteAccountingBindingSchema,
          },
        },
        description: "Requisite binding upserted",
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
        description: "Requisite not found",
      },
    },
  });

  function handleMutationError(error: unknown) {
    if (
      error instanceof ValidationError ||
      error instanceof RequisiteProviderNotActiveError ||
      error instanceof RequisiteAccountingBindingOwnerTypeError
    ) {
      return { status: 400 as const, body: { error: error.message } };
    }

    if (
      error instanceof RequisiteNotFoundError ||
      error instanceof OrganizationNotFoundError ||
      error instanceof CounterpartyNotFoundError
    ) {
      return { status: 404 as const, body: { error: error.message } };
    }

    return null;
  }

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.partiesModule.requisites.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(bankWorkspaceRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.partiesModule.requisites.queries.list({
        kind: ["bank"],
        limit: 200,
        offset: 0,
        ownerId: query.ownerId,
        ownerType: query.ownerType,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      const activeRows = result.data.filter((row) => row.archivedAt === null);
      const providerIds = [...new Set(activeRows.map((row) => row.providerId))];
      const currencyIds = [...new Set(activeRows.map((row) => row.currencyId))];
      const [providerEntries, currencyEntries] = await Promise.all([
        Promise.all(
          providerIds.map(async (providerId) => [
            providerId,
            await findBankWorkspaceProvider(ctx, providerId),
          ] as const),
        ),
        Promise.all(
          currencyIds.map(async (currencyId) => [
            currencyId,
            await findBankWorkspaceCurrency(ctx, currencyId),
          ] as const),
        ),
      ]);
      const providerById = new Map(providerEntries);
      const currencyById = new Map(currencyEntries);

      return c.json(
        {
          data: activeRows.map((row) => {
            const provider = providerById.get(row.providerId) ?? null;
            const currency = currencyById.get(row.currencyId);

            return {
              accountNo: row.accountNo,
              beneficiaryName: row.beneficiaryName,
              contact: row.contact,
              corrAccount: row.corrAccount,
              createdAt: row.createdAt.toISOString(),
              currency: {
                code: currency?.code ?? row.currencyId,
                id: row.currencyId,
                label: currency
                  ? `${currency.code} · ${currency.name}`
                  : row.currencyId,
                name: currency?.name ?? row.currencyId,
              },
              description: row.description,
              iban: row.iban,
              id: row.id,
              isDefault: row.isDefault,
              kind: "bank" as const,
              label: row.label,
              notes: row.notes,
              ownerId: row.ownerId,
              ownerType: row.ownerType,
              provider: provider
                ? {
                    address: provider.address,
                    bic: provider.bic,
                    country: provider.country,
                    id: provider.id,
                    name: provider.name,
                    swift: provider.swift,
                  }
                : null,
              providerId: row.providerId,
              updatedAt: row.updatedAt.toISOString(),
            };
          }),
        },
        200,
      );
    })
    .openapi(optionsRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.partiesModule.requisites.queries.listOptions(
        query,
      );

      return c.json(
        buildOptionsResponse(result, (item) =>
          RequisiteOptionSchema.parse(item),
        ),
        200,
      );
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");

      try {
        const requisite = await ctx.requisiteAccountingWorkflow.create(input);
        return c.json(requisite, 201);
      } catch (error) {
        const handled = handleMutationError(error);
        if (handled) {
          return c.json(handled.body, handled.status);
        }
        throw error;
      }
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const requisite = await ctx.partiesModule.requisites.queries.findById(
          id,
        );
        return c.json(requisite, 200);
      } catch (error) {
        if (error instanceof RequisiteNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(getProviderRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const requisite = await ctx.partiesModule.requisites.queries.findById(id);
        try {
          const provider =
            await ctx.partiesModule.requisites.queries.findProviderById(
              requisite.providerId,
            );
          return c.json(provider, 200);
        } catch (error) {
          if (error instanceof RequisiteProviderNotFoundError) {
            return c.json(null, 200);
          }
          throw error;
        }
      } catch (error) {
        if (error instanceof RequisiteNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const requisite = await ctx.requisiteAccountingWorkflow.update(
          id,
          input,
        );
        return c.json(requisite, 200);
      } catch (error) {
        const handled = handleMutationError(error);
        if (handled) {
          return c.json(handled.body, handled.status);
        }
        throw error;
      }
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        await ctx.partiesModule.requisites.commands.remove(id);
        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (error instanceof RequisiteNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(getBindingRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const binding = await ctx.partiesModule.requisites.queries.getBinding(
          id,
        );
        return c.json(binding, 200);
      } catch (error) {
        if (
          error instanceof RequisiteNotFoundError ||
          error instanceof RequisiteAccountingBindingNotFoundError
        ) {
          return c.json({ error: error.message }, 404);
        }
        if (error instanceof RequisiteAccountingBindingOwnerTypeError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(upsertBindingRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const binding = await ctx.requisiteAccountingWorkflow.upsertBinding(
          id,
          input,
        );
        return c.json(binding, 200);
      } catch (error) {
        const handled = handleMutationError(error);
        if (handled) {
          return c.json(handled.body, handled.status);
        }
        throw error;
      }
    });
}

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  ContractSchema,
  CreateContractInputSchema,
  ListContractsQuerySchema,
  UpdateContractInputSchema,
} from "@bedrock/operations/contracts";
import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsDeletedSchema, OpsErrorSchema, OpsIdParamSchema } from "./common";
import {
  findCanonicalOrganizationByLegacyId,
  resolveLegacyHoldingOrganizationByCanonicalId,
} from "../organization-bridge";

const PublicContractSchema = ContractSchema.omit({
  agentOrganizationId: true,
}).extend({
  organizationId: z.string().uuid().nullable(),
});

const PublicCreateContractInputSchema = CreateContractInputSchema.omit({
  agentOrganizationId: true,
}).extend({
  organizationId: z.string().uuid(),
});

const PublicUpdateContractInputSchema = UpdateContractInputSchema.omit({
  agentOrganizationId: true,
  id: true,
}).extend({
  organizationId: z.string().uuid().optional(),
});

const PaginatedContractsSchema = createPaginatedListSchema(PublicContractSchema);

async function serializeContractForPublic(
  ctx: AppContext,
  contract: z.infer<typeof ContractSchema>,
) {
  const { agentOrganizationId: _agentOrganizationId, ...rest } = contract;
  const organization = await findCanonicalOrganizationByLegacyId(
    ctx,
    contract.agentOrganizationId,
  );

  return {
    ...rest,
    organizationId: organization?.id ?? null,
  };
}

export function operationsContractsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Operations - Contracts"],
    summary: "List contracts",
    request: { query: ListContractsQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: PaginatedContractsSchema } },
        description: "Paginated contracts",
      },
    },
  });

  const getRoute = createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Operations - Contracts"],
    summary: "Get contract by ID",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: PublicContractSchema } },
        description: "Contract found",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Not found",
      },
    },
  });

  const createRoute_ = createRoute({
    method: "post",
    path: "/",
    tags: ["Operations - Contracts"],
    summary: "Create contract",
    request: {
      body: {
        content: {
          "application/json": { schema: PublicCreateContractInputSchema },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: PublicContractSchema } },
        description: "Contract created",
      },
    },
  });

  const updateRoute = createRoute({
    method: "patch",
    path: "/{id}",
    tags: ["Operations - Contracts"],
    summary: "Update contract",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": { schema: PublicUpdateContractInputSchema },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: PublicContractSchema } },
        description: "Contract updated",
      },
    },
  });

  const deleteRoute = createRoute({
    method: "delete",
    path: "/{id}",
    tags: ["Operations - Contracts"],
    summary: "Delete contract",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: OpsDeletedSchema } },
        description: "Contract deleted",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.operationsModule.contracts.queries.list(query);
      return c.json(
        {
          ...result,
          data: await Promise.all(
            result.data.map((contract) => serializeContractForPublic(ctx, contract)),
          ),
        },
        200,
      );
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      const contract =
        await ctx.operationsModule.contracts.queries.findById(id);
      if (!contract) return c.json({ error: "Contract not found" }, 404);
      return c.json(await serializeContractForPublic(ctx, contract), 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const legacyOrganization =
        await resolveLegacyHoldingOrganizationByCanonicalId(input.organizationId);
      const { organizationId: _organizationId, ...rest } = input;
      const result = await ctx.operationsModule.contracts.commands.create({
        ...rest,
        agentOrganizationId: legacyOrganization.id,
      });
      return c.json(await serializeContractForPublic(ctx, result), 201);
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const { organizationId, ...rest } = input;
      const legacyOrganization =
        organizationId === undefined
          ? null
          : await resolveLegacyHoldingOrganizationByCanonicalId(organizationId);
      const result = await ctx.operationsModule.contracts.commands.update({
        ...rest,
        ...(legacyOrganization
          ? { agentOrganizationId: legacyOrganization.id }
          : {}),
        id,
      });
      return c.json(
        await serializeContractForPublic(
          ctx,
          result as NonNullable<typeof result>,
        ),
        200,
      );
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");
      await ctx.operationsModule.contracts.commands.softDelete(id);
      return c.json({ deleted: true }, 200);
    });
}

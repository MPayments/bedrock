import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

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

const PaginatedContractsSchema = createPaginatedListSchema(ContractSchema);

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
        content: { "application/json": { schema: ContractSchema } },
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
        content: { "application/json": { schema: CreateContractInputSchema } },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: ContractSchema } },
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
        content: { "application/json": { schema: UpdateContractInputSchema.omit({ id: true }) } },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: ContractSchema } },
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
      return c.json(result, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      const contract =
        await ctx.operationsModule.contracts.queries.findById(id);
      if (!contract) return c.json({ error: "Contract not found" }, 404);
      return c.json(contract, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.contracts.commands.create(input);
      return c.json(result, 201);
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.contracts.commands.update({
        ...input,
        id,
      });
      return c.json(result as NonNullable<typeof result>, 200);
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");
      await ctx.operationsModule.contracts.commands.softDelete(id);
      return c.json({ deleted: true }, 200);
    });
}

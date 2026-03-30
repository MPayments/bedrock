import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import type { AppContext } from "../../context";
import { ErrorSchema, IdParamSchema } from "../../common";
import { handleRouteError } from "../../common/errors";
import { jsonOk } from "../../common/response";
import type { AuthVariables } from "../../middleware/auth";
import { withRequiredIdempotency } from "../../middleware/idempotency";
import { requirePermission } from "../../middleware/permission";
import { OpsDeletedSchema } from "./common";
import {
  archiveCompatibilityContract,
  CompatibilityContractsListQuerySchema,
  CompatibilityContractSchema,
  CompatibilityCreateContractInputSchema,
  CompatibilityUpdateContractInputSchema,
  createCompatibilityContract,
  findCompatibilityContractById,
  listCompatibilityContracts,
  PaginatedCompatibilityContractsSchema,
  updateCompatibilityContract,
} from "./contracts-compat";

export function operationsContractsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ agreements: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Operations - Contracts"],
    summary: "List compatibility contracts",
    request: { query: CompatibilityContractsListQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PaginatedCompatibilityContractsSchema },
        },
        description: "Paginated compatibility contracts",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Agreement invariant violation",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ agreements: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Operations - Contracts"],
    summary: "Get compatibility contract by canonical agreement id",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: CompatibilityContractSchema },
        },
        description: "Compatibility contract found",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Contract not found",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ agreements: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Operations - Contracts"],
    summary: "Create compatibility contract",
    request: {
      body: {
        content: {
          "application/json": { schema: CompatibilityCreateContractInputSchema },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": { schema: CompatibilityContractSchema },
        },
        description: "Compatibility contract created",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation or idempotency error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Client or referenced entity not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Active agreement already exists",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ agreements: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Operations - Contracts"],
    summary: "Update compatibility contract terms",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": { schema: CompatibilityUpdateContractInputSchema },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: CompatibilityContractSchema },
        },
        description: "Compatibility contract updated",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation or idempotency error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Contract not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Agreement invariant violation",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ agreements: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Operations - Contracts"],
    summary: "Archive compatibility contract",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: OpsDeletedSchema } },
        description: "Contract archived",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Contract not found",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await listCompatibilityContracts(ctx, query);
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await findCompatibilityContractById(ctx, id);
        if (!result) {
          return c.json({ error: "Contract not found" }, 404);
        }

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createRoute_, async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          createCompatibilityContract(
            ctx,
            body,
            c.get("user")!.id,
            idempotencyKey,
          ),
        );

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(c, result, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(updateRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          updateCompatibilityContract(
            ctx,
            body,
            id,
            c.get("user")!.id,
            idempotencyKey,
          ),
        );

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(deleteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        await archiveCompatibilityContract(ctx, id);
        return jsonOk(c, { deleted: true });
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}

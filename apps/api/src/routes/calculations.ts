import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  CalculationDetailsSchema,
  CreateCalculationInputSchema,
  ListCalculationsQuerySchema,
  PaginatedCalculationsSchema,
} from "@bedrock/calculations/contracts";

import { DeletedSchema, ErrorSchema, IdParamSchema } from "../common";
import { handleRouteError } from "../common/errors";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withRequiredIdempotency } from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

export function calculationsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ calculations: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Calculations"],
    summary: "List calculations",
    request: {
      query: ListCalculationsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedCalculationsSchema,
          },
        },
        description: "Paginated calculations",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ calculations: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Calculations"],
    summary: "Get calculation by id",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CalculationDetailsSchema,
          },
        },
        description: "Calculation found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Calculation not found",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ calculations: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Calculations"],
    summary: "Create calculation",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateCalculationInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: CalculationDetailsSchema,
          },
        },
        description: "Calculation created",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation or idempotency header error",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Referenced entity not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Idempotency conflict",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ calculations: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Calculations"],
    summary: "Archive calculation",
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
        description: "Calculation archived",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Calculation not found",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await ctx.calculationsModule.calculations.queries.list(
          query,
        );
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await ctx.calculationsModule.calculations.queries.findById(
          id,
        );
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createRoute_, async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.calculationsModule.calculations.commands.create({
            ...body,
            actorUserId: c.get("user")!.id,
            idempotencyKey,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(c, result, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(deleteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        await ctx.calculationsModule.calculations.commands.archive(id);
        return jsonOk(c, { deleted: true });
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}

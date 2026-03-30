import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import { ErrorSchema } from "../../common";
import { handleRouteError } from "../../common/errors";
import { jsonOk } from "../../common/response";
import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { withRequiredIdempotency } from "../../middleware/idempotency";
import { requirePermission } from "../../middleware/permission";
import { OpsDeletedSchema } from "./common";
import {
  archiveCompatibilityCalculation,
  CompatibilityCalculationCreateInputSchema,
  CompatibilityCalculationIdParamSchema,
  CompatibilityCalculationPreviewInputSchema,
  CompatibilityCalculationPreviewResultSchema,
  CompatibilityCalculationSchema,
  CompatibilityCalculationsListQuerySchema,
  createCompatibilityCalculation,
  findCompatibilityCalculationById,
  listCompatibilityCalculations,
  PaginatedCompatibilityCalculationsSchema,
  previewCompatibilityCalculation,
} from "./calculations-compat";

export function operationsCalculationsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ calculations: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Operations - Calculations"],
    summary: "List compatibility calculations",
    request: { query: CompatibilityCalculationsListQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PaginatedCompatibilityCalculationsSchema },
        },
        description: "Paginated compatibility calculations",
      },
      400: {
        content: {
          "application/json": { schema: ErrorSchema },
        },
        description: "Validation error",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ calculations: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Operations - Calculations"],
    summary: "Get compatibility calculation by canonical id",
    request: { params: CompatibilityCalculationIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: CompatibilityCalculationSchema } },
        description: "Calculation found",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Calculation not found",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ calculations: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Operations - Calculations"],
    summary: "Create compatibility calculation",
    request: {
      body: {
        content: {
          "application/json": { schema: CompatibilityCalculationCreateInputSchema },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": { schema: CompatibilityCalculationSchema },
        },
        description: "Calculation created",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation or idempotency error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Referenced deal not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Idempotency conflict",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ calculations: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Operations - Calculations"],
    summary: "Archive compatibility calculation",
    request: { params: CompatibilityCalculationIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: OpsDeletedSchema } },
        description: "Calculation archived",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Calculation not found",
      },
    },
  });

  const previewRoute = createRoute({
    middleware: [requirePermission({ calculations: ["create"] })],
    method: "post",
    path: "/preview",
    tags: ["Operations - Calculations"],
    summary: "Preview compatibility calculation without saving",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CompatibilityCalculationPreviewInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: CompatibilityCalculationPreviewResultSchema },
        },
        description: "Calculation preview",
      },
      400: {
        content: {
          "application/json": { schema: ErrorSchema },
        },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Referenced entity not found",
      },
    },
  });

  return app
    .openapi(previewRoute, async (c) => {
      try {
        const input = c.req.valid("json");
        const result = await previewCompatibilityCalculation(ctx, input);
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await listCompatibilityCalculations(query);
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await findCompatibilityCalculationById(id);
        if (!result) {
          return c.json({ error: "Calculation not found" }, 404);
        }

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createRoute_, async (c) => {
      try {
        const input = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          createCompatibilityCalculation(
            ctx,
            input,
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
    .openapi(deleteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        await archiveCompatibilityCalculation(ctx, id);
        return jsonOk(c, { deleted: true });
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}

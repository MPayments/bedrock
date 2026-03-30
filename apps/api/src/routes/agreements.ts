import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  AgreementDetailsSchema,
  CreateAgreementInputSchema,
  ListAgreementsQuerySchema,
  PaginatedAgreementsSchema,
} from "@bedrock/agreements/contracts";

import { ErrorSchema, IdParamSchema } from "../common";
import { handleRouteError } from "../common/errors";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import { withRequiredIdempotency } from "../middleware/idempotency";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

export function agreementsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ agreements: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Agreements"],
    summary: "List agreements",
    request: {
      query: ListAgreementsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedAgreementsSchema,
          },
        },
        description: "Paginated agreements",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ agreements: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Agreements"],
    summary: "Get agreement by id",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: AgreementDetailsSchema,
          },
        },
        description: "Agreement found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Agreement not found",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ agreements: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Agreements"],
    summary: "Create agreement",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateAgreementInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: AgreementDetailsSchema,
          },
        },
        description: "Agreement created",
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

  return app
    .openapi(listRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await ctx.agreementsModule.agreements.queries.list(query);
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await ctx.agreementsModule.agreements.queries.findById(id);
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createRoute_, async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.agreementsModule.agreements.commands.create({
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
    });
}

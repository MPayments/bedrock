import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  AgreementDetailsSchema,
  AgreementResolvedRouteDefaultsSchema,
  CreateAgreementInputSchema,
  ListAgreementsQuerySchema,
  PaginatedAgreementsSchema,
  ResolveAgreementRouteDefaultsQuerySchema,
  UpdateAgreementInputSchema,
} from "@bedrock/agreements/contracts";

import { DeletedSchema, ErrorSchema, IdParamSchema } from "../common";
import { handleRouteError } from "../common/errors";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withRequiredIdempotency } from "../middleware/idempotency";
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

  const resolveRouteDefaultsRoute = createRoute({
    middleware: [requirePermission({ agreements: ["list"] })],
    method: "get",
    path: "/{id}/route-defaults",
    tags: ["Agreements"],
    summary: "Resolve effective route defaults for an agreement",
    request: {
      params: IdParamSchema,
      query: ResolveAgreementRouteDefaultsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: AgreementResolvedRouteDefaultsSchema,
          },
        },
        description: "Effective route defaults",
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

  const updateRoute = createRoute({
    middleware: [requirePermission({ agreements: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Agreements"],
    summary: "Update agreement version-owned terms",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateAgreementInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: AgreementDetailsSchema,
          },
        },
        description: "Agreement updated",
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
        description: "Agreement not found",
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
    middleware: [requirePermission({ agreements: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Agreements"],
    summary: "Archive agreement",
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
        description: "Agreement archived",
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
    })
    .openapi(resolveRouteDefaultsRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const query = c.req.valid("query");
        const result =
          await ctx.agreementsModule.agreements.queries.resolveRouteDefaults({
            agreementId: id,
            ...query,
          });
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(updateRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.agreementsModule.agreements.commands.update({
            ...body,
            actorUserId: c.get("user")!.id,
            id,
            idempotencyKey,
          }),
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
        await ctx.agreementsModule.agreements.commands.archive(id);
        return jsonOk(c, { deleted: true });
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}

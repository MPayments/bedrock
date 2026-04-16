import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import {
  CounterpartyNotFoundError,
  CustomerNotFoundError,
  OrganizationNotFoundError,
} from "@bedrock/parties";
import {
  CreatePaymentRouteTemplateInputSchema,
  ListPaymentRouteTemplatesQuerySchema,
  PaymentRouteCalculationSchema,
  PaymentRouteDraftSchema,
  PaymentRouteTemplateListResponseSchema,
  PaymentRouteTemplateSchema,
  PreviewPaymentRouteInputSchema,
  UpdatePaymentRouteTemplateInputSchema,
} from "@bedrock/treasury/contracts";
import {
  PaymentRouteTemplateNotFoundError,
  ValidationError,
} from "@bedrock/treasury";

import { ErrorSchema, IdParamSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

async function resolveParticipantDisplayName(
  ctx: AppContext,
  participant: ReturnType<typeof PaymentRouteDraftSchema.parse>["participants"][number],
) {
  try {
    if (participant.kind === "customer") {
      const customer = await ctx.partiesModule.customers.queries.findById(
        participant.entityId,
      );
      return customer.name;
    }

    if (participant.kind === "organization") {
      const organization = await ctx.partiesModule.organizations.queries.findById(
        participant.entityId,
      );
      return organization.shortName;
    }

    const counterparty = await ctx.partiesModule.counterparties.queries.findById(
      participant.entityId,
    );
    return counterparty.shortName;
  } catch (error) {
    if (
      error instanceof CounterpartyNotFoundError ||
      error instanceof CustomerNotFoundError ||
      error instanceof OrganizationNotFoundError
    ) {
      throw new ValidationError(error.message);
    }

    throw error;
  }
}

async function normalizeRouteDraftParticipants(
  ctx: AppContext,
  draft: ReturnType<typeof PaymentRouteDraftSchema.parse>,
) {
  const participants = await Promise.all(
    draft.participants.map(async (participant) => ({
      ...participant,
      displayName: await resolveParticipantDisplayName(ctx, participant),
    })),
  );

  return {
    ...draft,
    participants,
  };
}

export function paymentRoutesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ payment_routes: ["list"] })],
    method: "get",
    path: "/",
    tags: ["PaymentRoutes"],
    summary: "List payment route templates",
    request: {
      query: ListPaymentRouteTemplatesQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaymentRouteTemplateListResponseSchema,
          },
        },
        description: "Paginated payment route templates",
      },
    },
  });

  const createTemplateRoute = createRoute({
    middleware: [requirePermission({ payment_routes: ["create"] })],
    method: "post",
    path: "/",
    tags: ["PaymentRoutes"],
    summary: "Create a payment route template",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreatePaymentRouteTemplateInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: PaymentRouteTemplateSchema,
          },
        },
        description: "Payment route template created",
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

  const previewRoute = createRoute({
    middleware: [requirePermission({ payment_routes: ["list"] })],
    method: "post",
    path: "/preview",
    tags: ["PaymentRoutes"],
    summary: "Preview a payment route calculation",
    request: {
      body: {
        content: {
          "application/json": {
            schema: PreviewPaymentRouteInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaymentRouteCalculationSchema,
          },
        },
        description: "Route calculation preview",
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

  const getTemplateRoute = createRoute({
    middleware: [requirePermission({ payment_routes: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["PaymentRoutes"],
    summary: "Get a payment route template by id",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaymentRouteTemplateSchema,
          },
        },
        description: "Payment route template",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Payment route template not found",
      },
    },
  });

  const updateTemplateRoute = createRoute({
    middleware: [requirePermission({ payment_routes: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["PaymentRoutes"],
    summary: "Update a payment route template",
    request: {
      body: {
        content: {
          "application/json": {
            schema: UpdatePaymentRouteTemplateInputSchema,
          },
        },
        required: true,
      },
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaymentRouteTemplateSchema,
          },
        },
        description: "Payment route template updated",
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
        description: "Payment route template not found",
      },
    },
  });

  const duplicateTemplateRoute = createRoute({
    middleware: [requirePermission({ payment_routes: ["create"] })],
    method: "post",
    path: "/{id}/duplicate",
    tags: ["PaymentRoutes"],
    summary: "Duplicate a payment route template",
    request: {
      params: IdParamSchema,
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: PaymentRouteTemplateSchema,
          },
        },
        description: "Duplicated payment route template",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Payment route template not found",
      },
    },
  });

  const archiveTemplateRoute = createRoute({
    middleware: [requirePermission({ payment_routes: ["archive"] })],
    method: "post",
    path: "/{id}/archive",
    tags: ["PaymentRoutes"],
    summary: "Archive a payment route template",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaymentRouteTemplateSchema,
          },
        },
        description: "Archived payment route template",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Payment route template not found",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.treasuryModule.paymentRoutes.queries.listTemplates(
        query,
      );
      return c.json(result, 200);
    })
    .openapi(createTemplateRoute, async (c) => {
      try {
        const body = c.req.valid("json");
        const template =
          await ctx.treasuryModule.paymentRoutes.commands.createTemplate({
            ...body,
            draft: await normalizeRouteDraftParticipants(ctx, body.draft),
          });
        return c.json(template, 201);
      } catch (error) {
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(previewRoute, async (c) => {
      try {
        const body = c.req.valid("json");
        const calculation =
          await ctx.treasuryModule.paymentRoutes.queries.previewTemplate({
            draft: await normalizeRouteDraftParticipants(ctx, body.draft),
          });
        return c.json(calculation, 200);
      } catch (error) {
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(getTemplateRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const template =
          await ctx.treasuryModule.paymentRoutes.queries.findTemplateById(id);
        return c.json(template, 200);
      } catch (error) {
        if (error instanceof PaymentRouteTemplateNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(updateTemplateRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const template =
          await ctx.treasuryModule.paymentRoutes.commands.updateTemplate(id, {
            ...body,
            ...(body.draft
              ? {
                  draft: await normalizeRouteDraftParticipants(ctx, body.draft),
                }
              : {}),
          });
        return c.json(template, 200);
      } catch (error) {
        if (error instanceof PaymentRouteTemplateNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(duplicateTemplateRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const template =
          await ctx.treasuryModule.paymentRoutes.commands.duplicateTemplate(id);
        return c.json(template, 201);
      } catch (error) {
        if (error instanceof PaymentRouteTemplateNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(archiveTemplateRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const template =
          await ctx.treasuryModule.paymentRoutes.commands.archiveTemplate(id);
        return c.json(template, 200);
      } catch (error) {
        if (error instanceof PaymentRouteTemplateNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    });
}

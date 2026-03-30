import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";

import {
  CustomerMembershipSchema,
} from "@bedrock/iam/contracts";
import {
  ClientSchema,
  CreateClientInputSchema,
  DealSchema,
} from "@bedrock/operations/contracts";
import {
  CustomerSchema,
} from "@bedrock/parties/contracts";

import { OpsErrorSchema, OpsIdParamSchema } from "./common";
import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { getRequestContext, withRequiredIdempotency } from "../../middleware/idempotency";

const CustomerPortalProfileSchema = z.object({
  customers: z.array(CustomerSchema),
  hasCrmAccess: z.boolean(),
  hasCustomerPortalAccess: z.boolean(),
  memberships: z.array(CustomerMembershipSchema),
});

const CustomerPortalLegalEntitySchema = z.object({
  address: z.string().nullable(),
  counterpartyId: z.string().uuid(),
  country: z.string().nullable(),
  createdAt: z.string(),
  directorName: z.string().nullable(),
  email: z.string().nullable(),
  externalId: z.string().nullable(),
  fullName: z.string(),
  hasLegacyShell: z.boolean(),
  inn: z.string().nullable(),
  phone: z.string().nullable(),
  relationshipKind: z.enum(["customer_owned", "external"]),
  shortName: z.string(),
  updatedAt: z.string(),
});

const CustomerPortalCustomerContextSchema = z.object({
  createdAt: z.string(),
  customerId: z.string().uuid(),
  description: z.string().nullable(),
  displayName: z.string(),
  externalRef: z.string().nullable(),
  legalEntities: z.array(CustomerPortalLegalEntitySchema),
  legalEntityCount: z.number().int(),
  primaryCounterpartyId: z.string().uuid().nullable(),
  updatedAt: z.string(),
});

const CustomerPortalCustomerContextsSchema = z.object({
  data: z.array(CustomerPortalCustomerContextSchema),
  total: z.number().int(),
});

const CustomerPortalCreateClientInputSchema = CreateClientInputSchema;
const CustomerPortalDealIdParamSchema = z.object({
  id: z.string().uuid(),
});
const CustomerPortalCreateDealInputSchema = z.object({
  counterpartyId: z.string().uuid(),
  requestedAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
  requestedCurrency: z.string().trim().min(3).max(16).optional(),
});
const CustomerPortalDealListItemSchema = z.object({
  calculation: z.any().nullable(),
  counterpartyId: z.string().uuid().nullable(),
  createdAt: z.string(),
  id: z.string().uuid(),
  organizationName: z.string().nullable(),
  requestedAmount: z.string().nullable(),
  requestedCurrencyCode: z.string().nullable(),
  status: z.enum([
    "draft",
    "submitted",
    "rejected",
    "preparing_documents",
    "awaiting_funds",
    "awaiting_payment",
    "closing_documents",
    "done",
    "cancelled",
  ]),
});
const CustomerPortalDealListSchema = z.object({
  data: z.array(CustomerPortalDealListItemSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});
const CustomerPortalDealDetailSchema = z.object({
  calculation: z.any().nullable(),
  deal: z.any(),
  organizationName: z.string().nullable(),
});

function requireCustomerPortalAccess(
  ctx: AppContext,
): MiddlewareHandler<{
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      await ctx.customerPortalWorkflow.assertPortalAccess({
        userId: user.id,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "CustomerNotAuthorizedError"
      ) {
        return c.json({ error: error.message }, 403);
      }

      throw error;
    }

    await next();
  };
}

export function operationsCustomerPortalRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const getProfileRoute = createRoute({
    method: "get",
    path: "/profile",
    tags: ["Operations - Customer Portal"],
    summary: "Get customer profile",
    responses: {
      200: {
        content: {
          "application/json": { schema: CustomerPortalProfileSchema },
        },
        description: "Customer profile",
      },
    },
  });

  const listClientsRoute = createRoute({
    method: "get",
    path: "/clients",
    tags: ["Operations - Customer Portal"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "List customer's clients",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CustomerPortalCustomerContextsSchema,
          },
        },
        description: "Customer's canonical customer contexts",
      },
    },
  });

  const listCustomerContextsRoute = createRoute({
    method: "get",
    path: "/customers",
    tags: ["Operations - Customer Portal"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "List customer's canonical customer contexts",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CustomerPortalCustomerContextsSchema,
          },
        },
        description: "Customer portal customer contexts",
      },
    },
  });

  const createClientRoute = createRoute({
    method: "post",
    path: "/clients",
    tags: ["Operations - Customer Portal"],
    summary: "Create client as customer",
    request: {
      body: {
        content: {
          "application/json": { schema: CustomerPortalCreateClientInputSchema },
        },
        required: true,
      },
    },
    responses: {
      400: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Missing Idempotency-Key",
      },
      403: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Not authorized",
      },
      201: {
        content: { "application/json": { schema: ClientSchema } },
        description: "Client created",
      },
    },
  });

  const createDealRoute = createRoute({
    method: "post",
    path: "/deals",
    tags: ["Operations - Customer Portal"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "Create customer deal",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CustomerPortalCreateDealInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      400: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Missing Idempotency-Key",
      },
      201: {
        content: { "application/json": { schema: z.any() } },
        description: "Deal created",
      },
      403: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Not authorized",
      },
    },
  });

  const listDealsRoute = createRoute({
    method: "get",
    path: "/deals",
    tags: ["Operations - Customer Portal"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "List customer's deals",
    request: {
      query: z.object({
        limit: z.coerce.number().int().default(20),
        offset: z.coerce.number().int().default(0),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: CustomerPortalDealListSchema } },
        description: "Customer's deals",
      },
    },
  });

  const getDealRoute = createRoute({
    method: "get",
    path: "/deals/{id}",
    tags: ["Operations - Customer Portal"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "Get customer's deal details",
    request: { params: CustomerPortalDealIdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: CustomerPortalDealDetailSchema },
        },
        description: "Deal details",
      },
      403: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Not authorized",
      },
    },
  });

  return app
    .openapi(getProfileRoute, async (c) => {
      const user = c.get("user")!;
      const result = await ctx.customerPortalWorkflow.getProfile({
        userId: user.id,
      });
      return c.json(result, 200);
    })
    .openapi(listClientsRoute, async (c) => {
      const user = c.get("user")!;
      const result = await ctx.customerPortalWorkflow.getClients({
        userId: user.id,
      });
      return c.json(result, 200);
    })
    .openapi(listCustomerContextsRoute, async (c) => {
      const user = c.get("user")!;
      const result = await ctx.customerPortalWorkflow.getCustomerContexts({
        userId: user.id,
      });
      return c.json(result, 200);
    })
    .openapi(createClientRoute, async (c) => {
      const user = c.get("user")!;
      const input = c.req.valid("json");
      const idempotencyKey = getRequestContext(c)?.idempotencyKey;

      if (!idempotencyKey) {
        return c.json({ error: "Missing Idempotency-Key header" }, 400);
      }

      try {
        const result = await ctx.customerPortalWorkflow.createClient(
          { userId: user.id },
          input,
          { idempotencyKey },
        );

        return c.json(result, 201);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "CustomerNotAuthorizedError"
        ) {
          return c.json({ error: error.message }, 403);
        }

        throw error;
      }
    })
    .openapi(createDealRoute, async (c) => {
      const user = c.get("user")!;
      const input = c.req.valid("json");
      try {
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.customerPortalWorkflow.createDeal(
            { userId: user.id },
            input,
            { idempotencyKey },
          ),
        );

        if (result instanceof Response) {
          return result;
        }

        return c.json(result, 201);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "CustomerNotAuthorizedError"
        ) {
          return c.json({ error: error.message }, 403);
        }
        throw error;
      }
    })
    .openapi(listDealsRoute, async (c) => {
      const user = c.get("user")!;
      const query = c.req.valid("query");
      const result = await ctx.customerPortalWorkflow.listMyDeals(
        { userId: user.id },
        query,
      );
      return c.json(result, 200);
    })
    .openapi(getDealRoute, async (c) => {
      const user = c.get("user")!;
      const { id } = c.req.valid("param");
      try {
        const result = await ctx.customerPortalWorkflow.getDealById(
          { userId: user.id },
          id,
        );
        return c.json(result, 200);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "CustomerNotAuthorizedError"
        ) {
          return c.json({ error: error.message }, 403);
        }
        throw error;
      }
    });
}

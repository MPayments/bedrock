import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";

import { CustomerMembershipSchema } from "@bedrock/iam/contracts";
import { CustomerSchema } from "@bedrock/parties/contracts";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import {
  getRequestContext,
  withRequiredIdempotency,
} from "../middleware/idempotency";
import { lookupCompanyByInn } from "./legal-entities";

const LocalizedTextSchema = z
  .object({
    en: z.string().nullable().optional(),
    ru: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

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

const CustomerPortalCreateLegalEntityInputSchema = z.object({
  address: z.string().nullable().optional(),
  addressI18n: LocalizedTextSchema,
  bankMode: z.enum(["existing", "manual"]),
  bankProviderId: z.string().uuid().nullable().optional(),
  bankProvider: z
    .object({
      address: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      routingCode: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  bankProviderI18n: z
    .object({
      address: LocalizedTextSchema,
      name: LocalizedTextSchema,
    })
    .nullable()
    .optional(),
  bankRequisite: z
    .object({
      accountNo: z.string().nullable().optional(),
      beneficiaryName: z.string().nullable().optional(),
      corrAccount: z.string().nullable().optional(),
      iban: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  country: z.string().nullable().optional(),
  directorBasis: z.string().nullable().optional(),
  directorBasisI18n: LocalizedTextSchema,
  directorName: z.string().nullable().optional(),
  directorNameI18n: LocalizedTextSchema,
  email: z
    .preprocess(
      (value) => (value === "" ? null : value),
      z.string().email().nullable().optional(),
    )
    .nullable()
    .optional(),
  inn: z.string().nullable().optional(),
  kpp: z.string().nullable().optional(),
  ogrn: z.string().nullable().optional(),
  okpo: z.string().nullable().optional(),
  oktmo: z.string().nullable().optional(),
  orgName: z.string().min(1),
  orgNameI18n: LocalizedTextSchema,
  orgType: z.string().nullable().optional(),
  orgTypeI18n: LocalizedTextSchema,
  phone: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  positionI18n: LocalizedTextSchema,
  subAgentCounterpartyId: z.string().uuid().nullable().optional(),
});

const CustomerPortalBankProviderSearchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8),
  query: z.string().trim().min(1),
});

const CustomerPortalBankProviderSearchResultSchema = z.object({
  address: z.string().nullable(),
  bic: z.string().nullable(),
  country: z.string().nullable(),
  displayLabel: z.string(),
  id: z.string().uuid(),
  name: z.string(),
  swift: z.string().nullable(),
});

const CustomerPortalCompanyLookupResultSchema = z.object({
  address: z.string().nullable(),
  directorBasis: z.string().nullable(),
  directorName: z.string().nullable(),
  inn: z.string(),
  kpp: z.string().nullable(),
  ogrn: z.string().nullable(),
  okpo: z.string().nullable(),
  oktmo: z.string().nullable(),
  orgName: z.string(),
  orgType: z.string().nullable(),
  position: z.string().nullable(),
});

const CustomerPortalDealIdParamSchema = z.object({
  id: z.string().uuid(),
});

const CustomerPortalCreateDealInputSchema = z.object({
  counterpartyId: z.string().uuid(),
  requestedAmount: z
    .string()
    .trim()
    .refine((value) => {
      const [whole, fraction, ...rest] = value.split(".");

      if (rest.length > 0 || !whole || !/^[0-9]+$/u.test(whole)) {
        return false;
      }

      if (fraction === undefined) {
        return true;
      }

      return fraction.length > 0 && /^[0-9]+$/u.test(fraction);
    })
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

export function customerRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const getProfileRoute = createRoute({
    method: "get",
    path: "/profile",
    tags: ["Customer"],
    summary: "Get customer portal profile",
    responses: {
      200: {
        content: {
          "application/json": { schema: CustomerPortalProfileSchema },
        },
        description: "Customer profile",
      },
    },
  });

  const listContextsRoute = createRoute({
    method: "get",
    path: "/contexts",
    tags: ["Customer"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "List customer portal contexts",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CustomerPortalCustomerContextsSchema,
          },
        },
        description: "Customer contexts",
      },
    },
  });

  const createLegalEntityRoute = createRoute({
    method: "post",
    path: "/legal-entities",
    tags: ["Customer"],
    summary: "Create a customer legal entity",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CustomerPortalCreateLegalEntityInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: z.any() } },
        description: "Legal entity created",
      },
      400: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Missing Idempotency-Key",
      },
      403: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Not authorized",
      },
    },
  });

  const searchBankProvidersRoute = createRoute({
    method: "get",
    path: "/legal-entities/bank-providers",
    tags: ["Customer"],
    summary: "Search bank providers for legal entity onboarding",
    request: {
      query: CustomerPortalBankProviderSearchQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              data: z.array(CustomerPortalBankProviderSearchResultSchema),
            }),
          },
        },
        description: "Bank provider matches",
      },
      403: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Not authorized",
      },
    },
  });

  const lookupByInnRoute = createRoute({
    method: "get",
    path: "/legal-entities/lookup-by-inn",
    tags: ["Customer"],
    summary: "Lookup company by INN for portal onboarding",
    request: {
      query: z.object({
        inn: z.string().min(1),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CustomerPortalCompanyLookupResultSchema.nullable(),
          },
        },
        description: "Lookup result",
      },
      403: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Not authorized",
      },
    },
  });

  const parseCardRoute = createRoute({
    method: "post",
    path: "/legal-entities/parse-card",
    tags: ["Customer"],
    summary: "Parse uploaded customer card for portal onboarding",
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Parsed card data",
      },
      403: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Not authorized",
      },
    },
  });

  const createDealRoute = createRoute({
    method: "post",
    path: "/deals",
    tags: ["Customer"],
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
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Missing Idempotency-Key",
      },
      201: {
        content: { "application/json": { schema: z.any() } },
        description: "Deal created",
      },
      403: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Not authorized",
      },
    },
  });

  const listDealsRoute = createRoute({
    method: "get",
    path: "/deals",
    tags: ["Customer"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "List customer deals",
    request: {
      query: z.object({
        limit: z.coerce.number().int().default(20),
        offset: z.coerce.number().int().default(0),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: CustomerPortalDealListSchema } },
        description: "Customer deals",
      },
    },
  });

  const getDealRoute = createRoute({
    method: "get",
    path: "/deals/{id}",
    tags: ["Customer"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "Get customer deal detail",
    request: { params: CustomerPortalDealIdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: CustomerPortalDealDetailSchema },
        },
        description: "Deal detail",
      },
      403: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
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
    .openapi(listContextsRoute, async (c) => {
      const user = c.get("user")!;
      const result = await ctx.customerPortalWorkflow.getCustomerContexts({
        userId: user.id,
      });
      return c.json(result, 200);
    })
    .openapi(createLegalEntityRoute, async (c) => {
      const user = c.get("user")!;
      const input = c.req.valid("json");
      const idempotencyKey = getRequestContext(c)?.idempotencyKey;

      if (!idempotencyKey) {
        return c.json({ error: "Idempotency-Key header is required" }, 400);
      }

      try {
        const result = await ctx.customerPortalWorkflow.createLegalEntity(
          {
            userId: user.id,
          },
          input,
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
    .openapi(searchBankProvidersRoute, async (c) => {
      const user = c.get("user")!;
      const query = c.req.valid("query");

      try {
        const data = await ctx.customerPortalWorkflow.searchBankProviders(
          { userId: user.id },
          query,
        );
        return c.json({ data }, 200);
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
    .openapi(lookupByInnRoute, async (c) => {
      const user = c.get("user")!;
      const { inn } = c.req.valid("query");

      try {
        await ctx.customerPortalWorkflow.assertOnboardingAccess({
          userId: user.id,
        });
        const result = await lookupCompanyByInn(ctx.env.DADATA_API_URL, inn);
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
    })
    .openapi(parseCardRoute, async (c): Promise<any> => {
      const user = c.get("user")!;

      try {
        await ctx.customerPortalWorkflow.assertOnboardingAccess({
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

      if (!ctx.documentExtraction) {
        return c.json({ error: "AI extraction not configured" }, 503);
      }

      const body = await c.req.parseBody();
      const file = body.file;
      if (!file || typeof file === "string") {
        return c.json({ error: "File is required" }, 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type;
      const result =
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          ? await ctx.documentExtraction.extractFromDocx(buffer)
          : mimeType ===
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ? await ctx.documentExtraction.extractFromXlsx(buffer)
            : await ctx.documentExtraction.extractFromPdf(buffer);

      return c.json(result, 200);
    })
    .openapi(createDealRoute, async (c): Promise<any> => {
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

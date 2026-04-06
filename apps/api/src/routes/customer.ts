import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";

import {
  DealActiveAgreementAmbiguousError,
  DealActiveAgreementNotFoundError,
} from "@bedrock/deals";
import { CreatePortalDealInputSchema } from "@bedrock/deals/contracts";
import {
  FileAttachmentPurposeSchema,
} from "@bedrock/files/contracts";
import { CustomerMembershipSchema } from "@bedrock/iam/contracts";
import { CustomerSchema } from "@bedrock/parties/contracts";
import {
  PortalDealListProjectionSchema,
  PortalDealProjectionSchema,
} from "@bedrock/workflow-deal-projections/contracts";

import { resolveEffectiveCustomerAgreementByCustomerId } from "./customer-agreements";
import { lookupCompanyByInn } from "./legal-entities";
import { DeletedSchema } from "../common";
import { handleRouteError } from "../common/errors";
import { withStoredResultRouteIdempotency } from "../common/route-idempotency";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import {
  getRequestContext,
  withRequiredIdempotency,
} from "../middleware/idempotency";

const LocalizedTextSchema = z
  .object({
    en: z.string().nullable().optional(),
    ru: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

const CustomerPortalProfileSchema = z.object({
  customers: z.array(CustomerSchema),
  hasOnboardingAccess: z.boolean(),
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
  inn: z.string().nullable(),
  phone: z.string().nullable(),
  relationshipKind: z.enum(["customer_owned", "external"]),
  shortName: z.string(),
  updatedAt: z.string(),
});

const CustomerPortalCustomerContextSchema = z.object({
  agentAgreement: z.object({
    contractNumber: z.string().nullable(),
    status: z.enum(["active", "missing"]),
  }),
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

const CustomerPortalBankProviderInputSchema = z
  .object({
    address: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    routingCode: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

const CustomerPortalBankRequisiteInputSchema = z
  .object({
    accountNo: z.string().nullable().optional(),
    beneficiaryName: z.string().nullable().optional(),
    corrAccount: z
      .string()
      .nullable()
      .optional()
      .refine(
        (value) => {
          if (!value || value === "") return true;
          return /^\d{20}$/u.test(value);
        },
        { message: "Корреспондентский счёт должен содержать 20 цифр" },
      ),
    iban: z
      .string()
      .nullable()
      .optional()
      .refine(
        (value) => {
          if (!value || value === "") return true;
          return /^[A-Z0-9]{15,34}$/iu.test(value);
        },
        { message: "IBAN должен содержать от 15 до 34 символов" },
      ),
  })
  .nullable()
  .optional();

type CustomerPortalCreateLegalEntityResponse = Awaited<
  ReturnType<AppContext["customerPortalWorkflow"]["createLegalEntity"]>
>;

const CUSTOMER_PORTAL_CREATE_LEGAL_ENTITY_IDEMPOTENCY_SCOPE =
  "customer.portal.create-legal-entity";

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function parseAttachmentPurpose(value: unknown) {
  return FileAttachmentPurposeSchema.safeParse(
    typeof value === "string" ? value : undefined,
  );
}

async function withCustomerPortalCreateLegalEntityIdempotency(input: {
  c: {
    get: (key: "requestContext") => ReturnType<typeof getRequestContext>;
    json: (body: unknown, status?: number) => Response;
  };
  ctx: AppContext;
  request: z.infer<typeof CustomerPortalCreateLegalEntityInputSchema>;
  run: () => Promise<CustomerPortalCreateLegalEntityResponse>;
  userId: string;
}) {
  const idempotencyKey = getRequestContext(input.c)?.idempotencyKey;

  if (!idempotencyKey) {
    return input.c.json({ error: "Idempotency-Key header is required" }, 400);
  }

  return withStoredResultRouteIdempotency({
    actorId: input.userId,
    idempotency: input.ctx.idempotency,
    idempotencyKey,
    persistence: input.ctx.persistence,
    request: {
      input: input.request,
      userId: input.userId,
    },
    run: input.run,
    scope: CUSTOMER_PORTAL_CREATE_LEGAL_ENTITY_IDEMPOTENCY_SCOPE,
  });
}

function hasBankSignal(input: {
  bankProvider?: z.infer<typeof CustomerPortalBankProviderInputSchema>;
  bankProviderId?: string | null;
  bankRequisite?: z.infer<typeof CustomerPortalBankRequisiteInputSchema>;
}) {
  return Boolean(
    input.bankProviderId ||
      hasText(input.bankProvider?.name ?? undefined) ||
      hasText(input.bankProvider?.address ?? undefined) ||
      hasText(input.bankProvider?.routingCode ?? undefined) ||
      hasText(input.bankRequisite?.accountNo ?? undefined) ||
      hasText(input.bankRequisite?.corrAccount ?? undefined) ||
      hasText(input.bankRequisite?.iban ?? undefined),
  );
}

function isValidRoutingCode(
  routingCode: string | null | undefined,
  country: string | null | undefined,
) {
  if (!routingCode) {
    return false;
  }

  const normalizedCountry = country?.trim().toUpperCase();
  const normalizedCode = routingCode.trim().toUpperCase();

  if (normalizedCountry === "RU") {
    return /^\d{9}$/u.test(normalizedCode);
  }

  return (
    (normalizedCode.length === 8 || normalizedCode.length === 11) &&
    /^[A-Z0-9]+$/u.test(normalizedCode)
  );
}

const CustomerPortalCreateLegalEntityInputSchema = z
  .object({
    address: z.string().nullable().optional(),
    addressI18n: LocalizedTextSchema,
    bankMode: z.enum(["existing", "manual"]),
    bankProviderId: z.string().uuid().nullable().optional(),
    bankProvider: CustomerPortalBankProviderInputSchema,
    bankProviderI18n: z
      .object({
        address: LocalizedTextSchema,
        name: LocalizedTextSchema,
      })
      .nullable()
      .optional(),
    bankRequisite: CustomerPortalBankRequisiteInputSchema,
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
  })
  .superRefine((data, ctx) => {
    if (!hasBankSignal(data)) {
      return;
    }

    if (data.bankMode === "existing" && !data.bankProviderId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankProviderId"],
        message: "Выберите банк из справочника или переключитесь на ручной ввод",
      });
    }

    if (data.bankMode === "manual") {
      if (!hasText(data.bankProvider?.name)) {
        ctx.addIssue({
          code: "custom",
          path: ["bankProvider", "name"],
          message: "Название банка обязательно",
        });
      }

      if (!hasText(data.bankProvider?.country)) {
        ctx.addIssue({
          code: "custom",
          path: ["bankProvider", "country"],
          message: "Страна банка обязательна",
        });
      }

      if (!hasText(data.bankProvider?.routingCode)) {
        ctx.addIssue({
          code: "custom",
          path: ["bankProvider", "routingCode"],
          message: "SWIFT / BIC обязателен",
        });
      } else if (
        !isValidRoutingCode(
          data.bankProvider?.routingCode,
          data.bankProvider?.country,
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["bankProvider", "routingCode"],
          message:
            data.bankProvider?.country?.toUpperCase() === "RU"
              ? "БИК должен содержать 9 цифр"
              : "SWIFT / BIC должен содержать 8 или 11 символов",
        });
      }
    }

    if (!hasText(data.bankRequisite?.beneficiaryName)) {
      ctx.addIssue({
        code: "custom",
        path: ["bankRequisite", "beneficiaryName"],
        message: "Получатель обязателен",
      });
    }

    if (!hasText(data.bankRequisite?.accountNo)) {
      ctx.addIssue({
        code: "custom",
        path: ["bankRequisite", "accountNo"],
        message: "Номер счета обязателен",
      });
    }
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
const CustomerPortalDealAttachmentParamsSchema = CustomerPortalDealIdParamSchema.extend(
  {
    attachmentId: z.string().uuid(),
  },
);

const CustomerPortalCreateDealDraftInputSchema = CreatePortalDealInputSchema;

const CustomerPortalDealListItemSchema = z.object({
  amount: z.string().nullable(),
  calculation: z.any().nullable(),
  counterpartyId: z.string().uuid().nullable(),
  createdAt: z.string(),
  currencyCode: z.string().nullable(),
  id: z.string().uuid(),
  organizationName: z.string().nullable(),
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
      403: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description: "Not authorized",
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

  const createDealDraftRoute = createRoute({
    method: "post",
    path: "/deals/drafts",
    tags: ["Customer"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "Create typed customer deal draft",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CustomerPortalCreateDealDraftInputSchema,
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
        content: {
          "application/json": { schema: PortalDealProjectionSchema },
        },
        description: "Typed deal draft created",
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

  const listDealProjectionsRoute = createRoute({
    method: "get",
    path: "/deals/projections",
    tags: ["Customer"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "List customer-safe deal projections",
    request: {
      query: z.object({
        limit: z.coerce.number().int().default(20),
        offset: z.coerce.number().int().default(0),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: PortalDealListProjectionSchema },
        },
        description: "Portal deal projections",
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

const getDealProjectionRoute = createRoute({
    method: "get",
    path: "/deals/{id}/projection",
    tags: ["Customer"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "Get customer-safe deal projection",
    request: { params: CustomerPortalDealIdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PortalDealProjectionSchema },
        },
        description: "Portal deal projection",
      },
      403: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Not authorized",
      },
    },
  });

  const listDealAttachmentsRoute = createRoute({
    method: "get",
    path: "/deals/{id}/attachments",
    tags: ["Customer"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "List customer-safe deal attachments",
    request: { params: CustomerPortalDealIdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(PortalDealProjectionSchema.shape.attachments.element),
          },
        },
        description: "Customer-safe deal attachments",
      },
      403: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Not authorized",
      },
    },
  });

  const uploadDealAttachmentRoute = createRoute({
    method: "post",
    path: "/deals/{id}/attachments",
    tags: ["Customer"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "Upload a customer-safe deal attachment",
    request: { params: CustomerPortalDealIdParamSchema },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: PortalDealProjectionSchema.shape.attachments.element,
          },
        },
        description: "Uploaded attachment",
      },
      400: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "File is required",
      },
      403: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Not authorized",
      },
    },
  });

  const downloadDealAttachmentRoute = createRoute({
    method: "get",
    path: "/deals/{id}/attachments/{attachmentId}/download",
    tags: ["Customer"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "Download a customer-safe deal attachment",
    request: { params: CustomerPortalDealAttachmentParamsSchema },
    responses: {
      302: {
        description: "Redirect to attachment download",
      },
      403: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Not authorized",
      },
    },
  });

  const deleteDealAttachmentRoute = createRoute({
    method: "delete",
    path: "/deals/{id}/attachments/{attachmentId}",
    tags: ["Customer"],
    middleware: [requireCustomerPortalAccess(ctx)],
    summary: "Delete a customer-safe deal attachment",
    request: { params: CustomerPortalDealAttachmentParamsSchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DeletedSchema,
          },
        },
        description: "Attachment deleted",
      },
      403: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Not authorized",
      },
    },
  });

  async function listAuthorizedCustomerIds(userId: string) {
    const result = await ctx.customerPortalWorkflow.getCustomerContexts({ userId });
    return Array.from(new Set(result.data.map((item) => item.customerId)));
  }

  async function findAuthorizedPortalDealProjection(
    userId: string,
    dealId: string,
  ) {
    const customerIds = await listAuthorizedCustomerIds(userId);

    for (const customerId of customerIds) {
      const projection = await ctx.dealProjectionsWorkflow.getPortalDealProjection(
        dealId,
        customerId,
      );

      if (projection) {
        return projection;
      }
    }

    throw new Error("CustomerNotAuthorizedError");
  }

  async function listAuthorizedPortalDealProjections(
    userId: string,
    input: { limit?: number; offset?: number },
  ) {
    const customerIds = await listAuthorizedCustomerIds(userId);

    const results = await Promise.all(
      customerIds.map((customerId) =>
        ctx.dealProjectionsWorkflow.listPortalDeals(customerId, 200, 0),
      ),
    );

    const allDeals = results.flatMap((result) => result.data);
    allDeals.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    const limit = input.limit ?? 20;
    const offset = input.offset ?? 0;

    return {
      data: allDeals.slice(offset, offset + limit),
      limit,
      offset,
      total: allDeals.length,
    };
  }

  return app
    .openapi(getProfileRoute, async (c) => {
      const user = c.get("user")!;
      try {
        const result = await ctx.customerPortalWorkflow.assertOnboardingAccess({
          userId: user.id,
        });
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
    .openapi(listContextsRoute, async (c) => {
      const user = c.get("user")!;
      const result = await ctx.customerPortalWorkflow.getCustomerContexts({
        userId: user.id,
      });
      const contractsByCustomerId = new Map(
        await Promise.all(
          result.data.map(async (customerContext) => {
            const contract =
              await resolveEffectiveCustomerAgreementByCustomerId(
                ctx,
                customerContext.customerId,
              );

            return [customerContext.customerId, contract] as const;
          }),
        ),
      );

      const data = result.data.map((customerContext) => {
        const contract =
          contractsByCustomerId.get(customerContext.customerId) ?? null;

        return {
          ...customerContext,
          agentAgreement: {
            contractNumber: contract?.contractNumber ?? null,
            status: contract?.isActive ? "active" : "missing",
          },
        } satisfies z.infer<typeof CustomerPortalCustomerContextSchema>;
      });

      return c.json(
        {
          data,
          total: data.length,
        },
        200,
      );
    })
    .openapi(createLegalEntityRoute, async (c): Promise<any> => {
      const user = c.get("user")!;
      const input = c.req.valid("json");

      try {
        const result = await withCustomerPortalCreateLegalEntityIdempotency({
          c,
          ctx,
          request: input,
          run: () =>
            ctx.customerPortalWorkflow.createLegalEntity(
              {
                userId: user.id,
              },
              input,
            ),
          userId: user.id,
        });

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
        const result = await lookupCompanyByInn(
          ctx.env.DADATA_API_URL,
          inn,
          ctx.env.DADATA_TIMEOUT_MS,
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
    .openapi(createDealDraftRoute, async (c): Promise<any> => {
      const user = c.get("user")!;
      const input = c.req.valid("json");

      try {
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.customerPortalWorkflow.createDealDraft(
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
          (error.name === "CustomerNotAuthorizedError" ||
            error.message === "CustomerNotAuthorizedError")
        ) {
          return c.json({ error: error.message }, 403);
        }

        if (error instanceof DealActiveAgreementNotFoundError) {
          return c.json(
            {
              error:
                "У клиента нет действующего агентского договора. Обратитесь к вашему менеджеру.",
            },
            400,
          );
        }

        if (error instanceof DealActiveAgreementAmbiguousError) {
          return c.json(
            {
              error:
                "У клиента несколько действующих агентских договоров. Обратитесь к вашему менеджеру.",
            },
            400,
          );
        }

        return handleRouteError(c, error);
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
    .openapi(listDealProjectionsRoute, async (c) => {
      const user = c.get("user")!;
      const query = c.req.valid("query");
      const result = await listAuthorizedPortalDealProjections(user.id, query);
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
    })
    .openapi(getDealProjectionRoute, async (c) => {
      const user = c.get("user")!;
      const { id } = c.req.valid("param");

      try {
        const result = await findAuthorizedPortalDealProjection(user.id, id);
        return c.json(result, 200);
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === "CustomerNotAuthorizedError" ||
            error.message === "CustomerNotAuthorizedError")
        ) {
          return c.json({ error: error.message }, 403);
        }

        throw error;
      }
    })
    .openapi(listDealAttachmentsRoute, async (c) => {
      const user = c.get("user")!;
      const { id } = c.req.valid("param");

      try {
        const projection = await findAuthorizedPortalDealProjection(user.id, id);
        return c.json(projection.attachments, 200);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "CustomerNotAuthorizedError"
        ) {
          return c.json({ error: "Deal not found" }, 403);
        }

        throw error;
      }
    })
    .openapi(uploadDealAttachmentRoute, async (c) => {
      const user = c.get("user")!;
      const { id } = c.req.valid("param");

      try {
        await findAuthorizedPortalDealProjection(user.id, id);

        const body = await c.req.parseBody();
        const file = body.file;
        if (!file || typeof file === "string") {
          return c.json({ error: "File is required" }, 400);
        }
        const purposeResult = parseAttachmentPurpose(body.purpose);
        if (!purposeResult.success) {
          return c.json(
            { error: "Purpose must be invoice, contract, or other" },
            400,
          );
        }

        const uploaded = await ctx.filesModule.files.commands.uploadDealAttachment({
          attachmentPurpose: purposeResult.data,
          attachmentVisibility: "customer_safe",
          buffer: Buffer.from(await file.arrayBuffer()),
          description:
            typeof body.description === "string" ? body.description : null,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          ownerId: id,
          uploadedBy: user.id,
        });

        try {
          await ctx.dealAttachmentIngestionWorkflow.enqueueIfEligible({
            dealId: id,
            fileAssetId: uploaded.id,
          });
        } catch (error) {
          ctx.logger.warn("Failed to enqueue portal deal attachment ingestion", {
            attachmentId: uploaded.id,
            dealId: id,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        await ctx.dealsModule.deals.commands.appendTimelineEvent({
          actorUserId: user.id,
          dealId: id,
          payload: {
            attachmentId: uploaded.id,
            fileName: uploaded.fileName,
          },
          sourceRef: `attachment:${uploaded.id}:uploaded:customer`,
          type: "attachment_uploaded",
          visibility: "customer_safe",
        });

        const projection = await findAuthorizedPortalDealProjection(user.id, id);
        const attachment = projection.attachments.find(
          (item) => item.id === uploaded.id,
        );

        return c.json(
          attachment ?? {
            createdAt: uploaded.createdAt,
            fileName: uploaded.fileName,
            id: uploaded.id,
            ingestionStatus: null,
            purpose: uploaded.purpose,
          },
          201,
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "CustomerNotAuthorizedError"
        ) {
          return c.json({ error: "Deal not found" }, 403);
        }

        throw error;
      }
    })
    .openapi(downloadDealAttachmentRoute, async (c) => {
      const user = c.get("user")!;
      const { attachmentId, id } = c.req.valid("param");

      try {
        const projection = await findAuthorizedPortalDealProjection(user.id, id);
        if (!projection.attachments.some((attachment) => attachment.id === attachmentId)) {
          return c.json({ error: "Deal not found" }, 403);
        }

        const url =
          await ctx.filesModule.files.queries.getDealAttachmentDownloadUrl({
            fileAssetId: attachmentId,
            ownerId: id,
          });

        return c.redirect(url, 302);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "CustomerNotAuthorizedError"
        ) {
          return c.json({ error: "Deal not found" }, 403);
        }

        throw error;
      }
    })
    .openapi(deleteDealAttachmentRoute, async (c) => {
      const user = c.get("user")!;
      const { attachmentId, id } = c.req.valid("param");

      try {
        const projection = await findAuthorizedPortalDealProjection(user.id, id);
        if (!projection.attachments.some((attachment) => attachment.id === attachmentId)) {
          return c.json({ error: "Deal not found" }, 403);
        }

        await ctx.filesModule.files.commands.deleteDealAttachment({
          fileAssetId: attachmentId,
          ownerId: id,
        });

        await ctx.dealsModule.deals.commands.appendTimelineEvent({
          actorUserId: user.id,
          dealId: id,
          payload: {
            attachmentId,
          },
          sourceRef: `attachment:${attachmentId}:deleted:customer`,
          type: "attachment_deleted",
          visibility: "customer_safe",
        });

        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "CustomerNotAuthorizedError"
        ) {
          return c.json({ error: "Deal not found" }, 403);
        }

        throw error;
      }
    });
}

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import { ActionReceiptConflictError } from "@bedrock/platform/idempotency-postgres";
import type { Transaction } from "@bedrock/platform/persistence";
import type { TreasuryModule } from "@bedrock/treasury";
import {
  ArtifactRefSchema,
  PaymentStepKindSchema,
  PaymentStepOriginSchema,
  PaymentStepPartyRefSchema,
  PaymentStepPurposeSchema,
  PaymentStepRateLockedSideSchema,
  PaymentStepRateSchema,
  PaymentStepStateSchema,
  PostingDocumentRefSchema,
  type PaymentStep,
} from "@bedrock/treasury/contracts";

import { ErrorSchema } from "../common";
import { handleRouteError } from "../common/errors";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withRequiredIdempotency } from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

type TreasuryStepsContext = Context<{ Variables: AuthVariables }>;

const PaymentStepIdParamsSchema = z.object({
  stepId: z.uuid(),
});

const PositiveMinorStringSchema = z
  .string()
  .regex(/^[1-9]\d*$/u, "Expected a positive minor-unit amount")
  .transform((value) => BigInt(value));

const OptionalMinorStringSchema = PositiveMinorStringSchema.nullable()
  .optional()
  .default(null);

const PaymentStepPartyInputSchema = PaymentStepPartyRefSchema.extend({
  requisiteId: z.uuid().nullable().optional().default(null),
});

const CreateStandalonePaymentStepBodySchema = z.object({
  fromAmountMinor: OptionalMinorStringSchema,
  fromCurrencyId: z.uuid(),
  fromParty: PaymentStepPartyInputSchema,
  id: z.uuid().optional(),
  initialState: z.enum(["draft", "pending"]).optional().default("draft"),
  kind: PaymentStepKindSchema,
  quoteId: z.uuid().nullable().optional().default(null),
  rate: PaymentStepRateSchema.nullable().optional().default(null),
  sourceRef: z.string().trim().min(1).max(512).optional(),
  toAmountMinor: OptionalMinorStringSchema,
  toCurrencyId: z.uuid(),
  toParty: PaymentStepPartyInputSchema,
});

const SubmitPaymentStepBodySchema = z.object({
  attemptId: z.uuid().optional(),
  providerRef: z.string().trim().min(1).max(255).nullable().optional().default(null),
  providerSnapshot: z.unknown().optional().default(null),
});

const ConfirmPaymentStepBodySchema = z.object({
  artifacts: z.array(ArtifactRefSchema).optional().default([]),
  attemptId: z.uuid().optional(),
  failureReason: z.string().trim().max(1000).nullable().optional().default(null),
  outcome: z.enum(["settled", "failed", "returned"]),
});

const RecordPaymentStepReturnBodySchema = z.object({
  amountMinor: OptionalMinorStringSchema,
  currencyId: z.uuid().nullable().optional().default(null),
  providerRef: z.string().trim().min(1).max(255).nullable().optional().default(null),
  reason: z.string().trim().max(1000).nullable().optional().default(null),
  returnId: z.uuid().optional(),
});

const AmendPaymentStepBodySchema = z.object({
  fromAmountMinor: PositiveMinorStringSchema.nullable().optional(),
  fromCurrencyId: z.uuid().optional(),
  fromParty: PaymentStepPartyInputSchema.optional(),
  rate: PaymentStepRateSchema.nullable().optional(),
  toAmountMinor: PositiveMinorStringSchema.nullable().optional(),
  toCurrencyId: z.uuid().optional(),
  toParty: PaymentStepPartyInputSchema.optional(),
});

const AttachPaymentStepPostingBodySchema = z.object({
  documentId: z.uuid(),
  kind: z.string().trim().min(1).max(64),
});

const ListPaymentStepsQuerySchema = z.object({
  batchId: z.uuid().optional(),
  createdFrom: z.iso.datetime().optional(),
  createdTo: z.iso.datetime().optional(),
  dealId: z.uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  purpose: PaymentStepPurposeSchema.optional(),
  state: z
    .union([PaymentStepStateSchema, z.array(PaymentStepStateSchema)])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value],
    ),
});

const PaymentStepAttemptResponseSchema = z.object({
  attemptNo: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  outcome: z.enum(["pending", "settled", "failed", "voided", "returned"]),
  outcomeAt: z.iso.datetime().nullable(),
  paymentStepId: z.uuid(),
  providerRef: z.string().nullable(),
  providerSnapshot: z.unknown(),
  submittedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const PaymentStepRouteResponseSchema = z.object({
  fromAmountMinor: z.string().nullable(),
  fromCurrencyId: z.uuid(),
  fromParty: PaymentStepPartyRefSchema,
  rate: z
    .object({
      lockedSide: PaymentStepRateLockedSideSchema,
      value: z.string(),
    })
    .nullable(),
  toAmountMinor: z.string().nullable(),
  toCurrencyId: z.uuid(),
  toParty: PaymentStepPartyRefSchema,
});

const PaymentStepAmendmentResponseSchema = z.object({
  after: PaymentStepRouteResponseSchema,
  before: PaymentStepRouteResponseSchema,
  createdAt: z.iso.datetime(),
  id: z.string(),
});

const PaymentStepReturnResponseSchema = z.object({
  amountMinor: z.string().nullable(),
  createdAt: z.iso.datetime(),
  currencyId: z.uuid().nullable(),
  id: z.string(),
  paymentStepId: z.uuid(),
  providerRef: z.string().nullable(),
  reason: z.string().nullable(),
  returnedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const PaymentStepResponseSchema = z.object({
  amendments: z.array(PaymentStepAmendmentResponseSchema),
  artifacts: z.array(ArtifactRefSchema),
  attempts: z.array(PaymentStepAttemptResponseSchema),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  dealId: z.uuid().nullable(),
  failureReason: z.string().nullable(),
  fromAmountMinor: z.string().nullable(),
  fromCurrencyId: z.uuid(),
  fromParty: PaymentStepPartyRefSchema,
  id: z.uuid(),
  kind: PaymentStepKindSchema,
  currentRoute: PaymentStepRouteResponseSchema,
  origin: PaymentStepOriginSchema,
  plannedRoute: PaymentStepRouteResponseSchema,
  postingDocumentRefs: z.array(PostingDocumentRefSchema),
  purpose: PaymentStepPurposeSchema,
  quoteId: z.uuid().nullable(),
  rate: z
    .object({
      lockedSide: PaymentStepRateLockedSideSchema,
      value: z.string(),
    })
    .nullable(),
  returns: z.array(PaymentStepReturnResponseSchema),
  scheduledAt: z.iso.datetime().nullable(),
  sourceRef: z.string(),
  state: PaymentStepStateSchema,
  submittedAt: z.iso.datetime().nullable(),
  toAmountMinor: z.string().nullable(),
  toCurrencyId: z.uuid(),
  toParty: PaymentStepPartyRefSchema,
  treasuryBatchId: z.uuid().nullable(),
  updatedAt: z.iso.datetime(),
});

const PaymentStepsListResponseSchema = z.object({
  data: z.array(PaymentStepResponseSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

type PaymentStepResponse = z.infer<typeof PaymentStepResponseSchema>;

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeNullableDate(value: Date | string | null): string | null {
  return value ? serializeDate(value) : null;
}

function serializeMinor(value: bigint | string | null): string | null {
  return value === null ? null : value.toString();
}

function serializeRoute(route: PaymentStep["currentRoute"]) {
  return {
    ...route,
    fromAmountMinor: serializeMinor(route.fromAmountMinor),
    toAmountMinor: serializeMinor(route.toAmountMinor),
  };
}

function serializePaymentStep(step: PaymentStep): PaymentStepResponse {
  return {
    ...step,
    amendments: step.amendments.map((amendment) => ({
      after: serializeRoute(amendment.after),
      before: serializeRoute(amendment.before),
      createdAt: serializeDate(amendment.createdAt),
      id: amendment.id,
    })),
    attempts: step.attempts.map((attempt) => ({
      ...attempt,
      createdAt: serializeDate(attempt.createdAt),
      outcomeAt: serializeNullableDate(attempt.outcomeAt),
      submittedAt: serializeDate(attempt.submittedAt),
      updatedAt: serializeDate(attempt.updatedAt),
    })),
    completedAt: serializeNullableDate(step.completedAt),
    createdAt: serializeDate(step.createdAt),
    currentRoute: serializeRoute(step.currentRoute),
    fromAmountMinor: serializeMinor(step.fromAmountMinor),
    origin: step.origin,
    plannedRoute: serializeRoute(step.plannedRoute),
    postingDocumentRefs: step.postingDocumentRefs,
    returns: step.returns.map((record) => ({
      ...record,
      amountMinor: serializeMinor(record.amountMinor),
      createdAt: serializeDate(record.createdAt),
      returnedAt: serializeDate(record.returnedAt),
      updatedAt: serializeDate(record.updatedAt),
    })),
    scheduledAt: serializeNullableDate(step.scheduledAt),
    submittedAt: serializeNullableDate(step.submittedAt),
    toAmountMinor: serializeMinor(step.toAmountMinor),
    updatedAt: serializeDate(step.updatedAt),
  };
}

function resolvePaymentStepsModule(
  ctx: AppContext,
  tx: Transaction,
): TreasuryModule["paymentSteps"] {
  return ctx.createTreasuryModule(tx).paymentSteps;
}

async function runIdempotentStepMutation(
  ctx: AppContext,
  c: TreasuryStepsContext,
  input: {
    action: string;
    request: Record<string, unknown>;
    run: (paymentSteps: TreasuryModule["paymentSteps"]) => Promise<PaymentStep>;
  },
): Promise<PaymentStepResponse | Response> {
  const scope = `treasury.payment_steps.${input.action}`;
  const result = await withRequiredIdempotency(c, (idempotencyKey) =>
    ctx.persistence.runInTransaction((tx) =>
      ctx.idempotency.withIdempotencyTx<
        PaymentStepResponse,
        PaymentStepResponse
      >({
        actorId: c.get("user")!.id,
        handler: async () =>
          serializePaymentStep(
            await input.run(resolvePaymentStepsModule(ctx, tx)),
          ),
        idempotencyKey,
        loadReplayResult: async ({ storedResult }) => {
          if (!storedResult) {
            throw new ActionReceiptConflictError(scope, idempotencyKey);
          }

          return storedResult;
        },
        request: input.request,
        scope,
        serializeResult: (step) => step,
        tx,
      }),
    ),
  );

  return result;
}

export function treasuryStepsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const createStepRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/",
    tags: ["Treasury"],
    summary: "Create a standalone treasury payment step",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateStandalonePaymentStepBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        description: "Payment step created",
        content: {
          "application/json": {
            schema: PaymentStepResponseSchema,
          },
        },
      },
      400: {
        description: "Validation or idempotency header error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      409: {
        description: "Idempotency conflict",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const listStepsRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Treasury"],
    summary: "List treasury payment steps",
    request: {
      query: ListPaymentStepsQuerySchema,
    },
    responses: {
      200: {
        description: "Paginated payment steps",
        content: {
          "application/json": {
            schema: PaymentStepsListResponseSchema,
          },
        },
      },
    },
  });

  const getStepRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{stepId}",
    tags: ["Treasury"],
    summary: "Get a treasury payment step",
    request: {
      params: PaymentStepIdParamsSchema,
    },
    responses: {
      200: {
        description: "Payment step",
        content: {
          "application/json": {
            schema: PaymentStepResponseSchema,
          },
        },
      },
      404: {
        description: "Payment step not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const submitStepRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{stepId}/submit",
    tags: ["Treasury"],
    summary: "Submit a treasury payment step",
    request: {
      params: PaymentStepIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: SubmitPaymentStepBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Payment step submitted",
        content: {
          "application/json": {
            schema: PaymentStepResponseSchema,
          },
        },
      },
      400: {
        description: "Validation or idempotency header error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Payment step not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      409: {
        description: "Invalid state or idempotency conflict",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const confirmStepRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{stepId}/confirm",
    tags: ["Treasury"],
    summary: "Confirm a treasury payment step outcome",
    request: {
      params: PaymentStepIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: ConfirmPaymentStepBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Payment step outcome recorded",
        content: {
          "application/json": {
            schema: PaymentStepResponseSchema,
          },
        },
      },
      400: {
        description: "Validation or idempotency header error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Payment step not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      409: {
        description: "Invalid state or idempotency conflict",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const recordReturnRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{stepId}/returns",
    tags: ["Treasury"],
    summary: "Record a return/reversal event for a completed payment step",
    request: {
      params: PaymentStepIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: RecordPaymentStepReturnBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Payment step return recorded",
        content: {
          "application/json": {
            schema: PaymentStepResponseSchema,
          },
        },
      },
      400: {
        description: "Validation or idempotency header error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Payment step not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      409: {
        description: "Invalid state or idempotency conflict",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const cancelStepRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{stepId}/cancel",
    tags: ["Treasury"],
    summary: "Cancel a treasury payment step",
    request: {
      params: PaymentStepIdParamsSchema,
    },
    responses: {
      200: {
        description: "Payment step cancelled",
        content: {
          "application/json": {
            schema: PaymentStepResponseSchema,
          },
        },
      },
      400: {
        description: "Validation or idempotency header error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Payment step not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      409: {
        description: "Invalid state or idempotency conflict",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const amendStepRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{stepId}/amend",
    tags: ["Treasury"],
    summary: "Amend a treasury payment step route",
    request: {
      params: PaymentStepIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: AmendPaymentStepBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Payment step amended",
        content: {
          "application/json": {
            schema: PaymentStepResponseSchema,
          },
        },
      },
      400: {
        description: "Validation or idempotency header error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Payment step not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      409: {
        description: "Invalid state or idempotency conflict",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const uploadAttachmentRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{stepId}/attachments",
    tags: ["Treasury"],
    summary: "Upload an evidence attachment scoped to a payment step",
    request: {
      params: PaymentStepIdParamsSchema,
    },
    responses: {
      201: {
        description: "Evidence file uploaded — returns the file-asset id",
        content: {
          "application/json": {
            schema: z.object({ id: z.uuid() }),
          },
        },
      },
      400: {
        description: "Bad multipart payload or missing step",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Payment step not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const attachPostingRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{stepId}/postings",
    tags: ["Treasury"],
    summary: "Link a posting document to a treasury payment step",
    request: {
      params: PaymentStepIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: AttachPaymentStepPostingBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Payment step updated with the linked posting",
        content: {
          "application/json": {
            schema: PaymentStepResponseSchema,
          },
        },
      },
      400: {
        description: "Validation or idempotency header error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Payment step not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      409: {
        description: "Idempotency conflict",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const skipStepRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{stepId}/skip",
    tags: ["Treasury"],
    summary: "Skip a treasury payment step",
    request: {
      params: PaymentStepIdParamsSchema,
    },
    responses: {
      200: {
        description: "Payment step skipped",
        content: {
          "application/json": {
            schema: PaymentStepResponseSchema,
          },
        },
      },
      400: {
        description: "Validation or idempotency header error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Payment step not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      409: {
        description: "Invalid state or idempotency conflict",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  return app
    .openapi(createStepRoute, async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await runIdempotentStepMutation(ctx, c, {
          action: "create",
          request: { body },
          run: (paymentSteps) =>
            paymentSteps.commands.create({
              ...body,
              dealId: null,
              origin: {
                dealId: null,
                planLegId: null,
                routeSnapshotLegId: null,
                sequence: null,
                treasuryOrderId: null,
                type: "manual",
              },
              purpose: "standalone_payment",
              planLegId: null,
              routeSnapshotLegId: null,
              sequence: null,
              sourceRef: body.sourceRef ?? `manual:${body.id ?? crypto.randomUUID()}`,
              treasuryBatchId: null,
              treasuryOrderId: null,
            }),
        });

        return result instanceof Response ? result : c.json(result, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listStepsRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await ctx.treasuryModule.paymentSteps.queries.list({
          batchId: query.batchId,
          createdFrom: query.createdFrom
            ? new Date(query.createdFrom)
            : undefined,
          createdTo: query.createdTo ? new Date(query.createdTo) : undefined,
          dealId: query.dealId,
          limit: query.limit,
          offset: query.offset,
          purpose: query.purpose,
          state: query.state,
        });

        return c.json(
          {
            data: result.data.map(serializePaymentStep),
            limit: result.limit,
            offset: result.offset,
            total: result.total,
          },
          200,
        );
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getStepRoute, async (c) => {
      try {
        const { stepId } = c.req.valid("param");
        const result = await ctx.treasuryModule.paymentSteps.queries.findById({
          stepId,
        });

        return c.json(serializePaymentStep(result), 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(submitStepRoute, async (c) => {
      try {
        const { stepId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await runIdempotentStepMutation(ctx, c, {
          action: "submit",
          request: { body, stepId },
          run: (paymentSteps) =>
            paymentSteps.commands.submit({
              ...body,
              stepId,
            }),
        });

        return result instanceof Response ? result : c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(confirmStepRoute, async (c) => {
      try {
        const { stepId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await runIdempotentStepMutation(ctx, c, {
          action: "confirm",
          request: { body, stepId },
          run: (paymentSteps) =>
            paymentSteps.commands.confirm({
              ...body,
              stepId,
            }),
        });

        return result instanceof Response ? result : c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(recordReturnRoute, async (c) => {
      try {
        const { stepId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await runIdempotentStepMutation(ctx, c, {
          action: "record_return",
          request: { body, stepId },
          run: (paymentSteps) =>
            paymentSteps.commands.recordReturn({
              ...body,
              stepId,
            }),
        });

        return result instanceof Response ? result : c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(cancelStepRoute, async (c) => {
      try {
        const { stepId } = c.req.valid("param");
        const result = await runIdempotentStepMutation(ctx, c, {
          action: "cancel",
          request: { stepId },
          run: (paymentSteps) => paymentSteps.commands.cancel({ stepId }),
        });

        return result instanceof Response ? result : c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(amendStepRoute, async (c) => {
      try {
        const { stepId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await runIdempotentStepMutation(ctx, c, {
          action: "amend",
          request: { body, stepId },
          run: (paymentSteps) =>
            paymentSteps.commands.amend({
              ...body,
              stepId,
            }),
        });

        return result instanceof Response ? result : c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(skipStepRoute, async (c) => {
      try {
        const { stepId } = c.req.valid("param");
        const result = await runIdempotentStepMutation(ctx, c, {
          action: "skip",
          request: { stepId },
          run: (paymentSteps) => paymentSteps.commands.skip({ stepId }),
        });

        return result instanceof Response ? result : c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(uploadAttachmentRoute, async (c) => {
      try {
        const { stepId } = c.req.valid("param");
        const body = await c.req.parseBody();
        const file = body.file;
        if (!file || typeof file === "string") {
          return c.json({ error: "File is required" }, 400 as const);
        }

        // Guard against dangling uploads: the step must exist before we
        // allocate a file asset scoped to its id.
        const step = await ctx.treasuryModule.paymentSteps.queries.findById({
          stepId,
        });
        if (!step) {
          return c.json(
            { error: `Payment step ${stepId} not found` },
            404 as const,
          );
        }

        const attachment =
          await ctx.filesModule.files.commands.uploadPaymentStepAttachment({
            attachmentPurpose: "other",
            attachmentVisibility: "internal",
            buffer: Buffer.from(await file.arrayBuffer()),
            description:
              typeof body.description === "string" ? body.description : null,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            ownerId: stepId,
            uploadedBy: c.get("user")!.id,
          });

        return c.json({ id: attachment.id }, 201 as const);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(attachPostingRoute, async (c) => {
      try {
        const { stepId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await runIdempotentStepMutation(ctx, c, {
          action: "attach_posting",
          request: {
            documentId: body.documentId,
            kind: body.kind,
            stepId,
          },
          run: (paymentSteps) =>
            paymentSteps.commands.attachPosting({
              documentId: body.documentId,
              kind: body.kind,
              stepId,
            }),
        });

        return result instanceof Response ? result : c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}

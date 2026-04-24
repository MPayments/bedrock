import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import { ActionReceiptConflictError } from "@bedrock/platform/idempotency-postgres";
import type { Transaction } from "@bedrock/platform/persistence";
import type { TreasuryModule } from "@bedrock/treasury";
import {
  ArtifactRefSchema,
  PaymentStepDealLegRoleSchema,
  PaymentStepKindSchema,
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
  rate: PaymentStepRateSchema.nullable().optional().default(null),
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

const AmendPaymentStepBodySchema = z.object({
  fromAmountMinor: PositiveMinorStringSchema.nullable().optional(),
  fromCurrencyId: z.uuid().optional(),
  fromParty: PaymentStepPartyInputSchema.optional(),
  rate: PaymentStepRateSchema.nullable().optional(),
  toAmountMinor: PositiveMinorStringSchema.nullable().optional(),
  toCurrencyId: z.uuid().optional(),
  toParty: PaymentStepPartyInputSchema.optional(),
});

const ListPaymentStepsQuerySchema = z.object({
  batchId: z.uuid().optional(),
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

const PaymentStepResponseSchema = z.object({
  artifacts: z.array(ArtifactRefSchema),
  attempts: z.array(PaymentStepAttemptResponseSchema),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  dealId: z.uuid().nullable(),
  dealLegIdx: z.number().int().nonnegative().nullable(),
  dealLegRole: PaymentStepDealLegRoleSchema.nullable(),
  failureReason: z.string().nullable(),
  fromAmountMinor: z.string().nullable(),
  fromCurrencyId: z.uuid(),
  fromParty: PaymentStepPartyRefSchema,
  id: z.uuid(),
  kind: PaymentStepKindSchema,
  postings: z.array(PostingDocumentRefSchema),
  purpose: PaymentStepPurposeSchema,
  rate: z
    .object({
      lockedSide: PaymentStepRateLockedSideSchema,
      value: z.string(),
    })
    .nullable(),
  scheduledAt: z.iso.datetime().nullable(),
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

function serializePaymentStep(step: PaymentStep): PaymentStepResponse {
  return {
    ...step,
    attempts: step.attempts.map((attempt) => ({
      ...attempt,
      createdAt: serializeDate(attempt.createdAt),
      outcomeAt: serializeNullableDate(attempt.outcomeAt),
      submittedAt: serializeDate(attempt.submittedAt),
      updatedAt: serializeDate(attempt.updatedAt),
    })),
    completedAt: serializeNullableDate(step.completedAt),
    createdAt: serializeDate(step.createdAt),
    fromAmountMinor: serializeMinor(step.fromAmountMinor),
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
              dealLegIdx: null,
              dealLegRole: null,
              purpose: "standalone_payment",
              treasuryBatchId: null,
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
    });
}

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import { ActionReceiptConflictError } from "@bedrock/platform/idempotency-postgres";
import type { Transaction } from "@bedrock/platform/persistence";
import type { TreasuryModule } from "@bedrock/treasury";
import {
  PaymentStepPartyRefSchema,
  QuoteExecutionStateSchema,
  type QuoteExecution,
} from "@bedrock/treasury/contracts";

import { ErrorSchema } from "../common";
import { handleRouteError } from "../common/errors";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withRequiredIdempotency } from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

type TreasuryQuoteExecutionsContext = Context<{ Variables: AuthVariables }>;

const QuoteExecutionIdParamsSchema = z.object({
  executionId: z.uuid(),
});

const SubmitQuoteExecutionBodySchema = z.object({
  providerRef: z.string().trim().min(1).max(255).nullable().optional().default(null),
  providerSnapshot: z.unknown().optional().default(null),
});

const ConfirmQuoteExecutionBodySchema = z.object({
  failureReason: z.string().trim().max(1000).nullable().optional().default(null),
  outcome: z.enum(["settled", "failed"]),
});

const ListQuoteExecutionsQuerySchema = z.object({
  dealId: z.uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  quoteId: z.uuid().optional(),
  state: QuoteExecutionStateSchema.optional(),
  treasuryOrderId: z.uuid().optional(),
});

const QuoteExecutionResponseSchema = z.object({
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  dealId: z.uuid().nullable(),
  failureReason: z.string().nullable(),
  fromAmountMinor: z.string(),
  fromCurrencyId: z.uuid(),
  id: z.uuid(),
  origin: z.object({
    dealId: z.uuid().nullable(),
    planLegId: z.string().nullable(),
    routeSnapshotLegId: z.string().nullable(),
    sequence: z.number().int().nonnegative().nullable(),
    treasuryOrderId: z.uuid().nullable(),
    type: z.enum(["deal_execution_leg", "treasury_order_step", "manual"]),
  }),
  postingDocumentRefs: z.array(
    z.object({
      documentId: z.uuid(),
      kind: z.string(),
    }),
  ),
  providerRef: z.string().nullable(),
  providerSnapshot: z.unknown(),
  quoteId: z.uuid(),
  quoteLegIdx: z.number().int().positive().nullable(),
  rateDen: z.string(),
  rateNum: z.string(),
  executionParties: z.object({
    creditParty: PaymentStepPartyRefSchema,
    debitParty: PaymentStepPartyRefSchema,
  }).nullable(),
  sourceRef: z.string(),
  state: QuoteExecutionStateSchema,
  submittedAt: z.iso.datetime().nullable(),
  toAmountMinor: z.string(),
  toCurrencyId: z.uuid(),
  treasuryOrderId: z.uuid().nullable(),
  updatedAt: z.iso.datetime(),
});

const QuoteExecutionsListResponseSchema = z.object({
  data: z.array(QuoteExecutionResponseSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

type QuoteExecutionResponse = z.infer<typeof QuoteExecutionResponseSchema>;

function serializeDate(value: Date) {
  return value.toISOString();
}

function serializeNullableDate(value: Date | null) {
  return value ? serializeDate(value) : null;
}

function serializeQuoteExecution(
  execution: QuoteExecution,
): QuoteExecutionResponse {
  return {
    completedAt: serializeNullableDate(execution.completedAt),
    createdAt: serializeDate(execution.createdAt),
    dealId: execution.dealId,
    failureReason: execution.failureReason,
    fromAmountMinor: execution.fromAmountMinor.toString(),
    fromCurrencyId: execution.fromCurrencyId,
    id: execution.id,
    origin: execution.origin,
    postingDocumentRefs: execution.postingDocumentRefs,
    providerRef: execution.providerRef,
    providerSnapshot: execution.providerSnapshot,
    quoteId: execution.quoteId,
    quoteLegIdx: execution.quoteLegIdx,
    rateDen: execution.rateDen.toString(),
    rateNum: execution.rateNum.toString(),
    executionParties: execution.executionParties,
    sourceRef: execution.sourceRef,
    state: execution.state,
    submittedAt: serializeNullableDate(execution.submittedAt),
    toAmountMinor: execution.toAmountMinor.toString(),
    toCurrencyId: execution.toCurrencyId,
    treasuryOrderId: execution.treasuryOrderId,
    updatedAt: serializeDate(execution.updatedAt),
  };
}

function resolveQuoteExecutionsModule(
  ctx: AppContext,
  tx: Transaction,
): TreasuryModule["quoteExecutions"] {
  return ctx.createTreasuryModule(tx).quoteExecutions;
}

async function runIdempotentQuoteExecutionMutation(
  ctx: AppContext,
  c: TreasuryQuoteExecutionsContext,
  input: {
    action: string;
    request: Record<string, unknown>;
    run: (
      quoteExecutions: TreasuryModule["quoteExecutions"],
    ) => Promise<QuoteExecution>;
  },
): Promise<QuoteExecutionResponse | Response> {
  const scope = `treasury.quote_executions.${input.action}`;
  return withRequiredIdempotency(c, (idempotencyKey) =>
    ctx.persistence.runInTransaction((tx) =>
      ctx.idempotency.withIdempotencyTx<
        QuoteExecutionResponse,
        QuoteExecutionResponse
      >({
        actorId: c.get("user")!.id,
        handler: async () =>
          serializeQuoteExecution(
            await input.run(resolveQuoteExecutionsModule(ctx, tx)),
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
        serializeResult: (execution) => execution,
        tx,
      }),
    ),
  );
}

export function treasuryQuoteExecutionsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Treasury"],
    summary: "List treasury quote executions",
    request: { query: ListQuoteExecutionsQuerySchema },
    responses: {
      200: {
        description: "Paginated quote executions",
        content: {
          "application/json": { schema: QuoteExecutionsListResponseSchema },
        },
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{executionId}",
    tags: ["Treasury"],
    summary: "Get a treasury quote execution",
    request: { params: QuoteExecutionIdParamsSchema },
    responses: {
      200: {
        description: "Quote execution",
        content: {
          "application/json": { schema: QuoteExecutionResponseSchema },
        },
      },
      404: {
        description: "Quote execution not found",
        content: {
          "application/json": { schema: ErrorSchema },
        },
      },
    },
  });

  const submitRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{executionId}/submit",
    tags: ["Treasury"],
    summary: "Submit a treasury quote execution",
    request: {
      params: QuoteExecutionIdParamsSchema,
      body: {
        content: {
          "application/json": { schema: SubmitQuoteExecutionBodySchema },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Quote execution submitted",
        content: {
          "application/json": { schema: QuoteExecutionResponseSchema },
        },
      },
      400: {
        description: "Validation or idempotency header error",
        content: {
          "application/json": { schema: ErrorSchema },
        },
      },
      404: {
        description: "Quote execution not found",
        content: {
          "application/json": { schema: ErrorSchema },
        },
      },
      409: {
        description: "Invalid state or idempotency conflict",
        content: {
          "application/json": { schema: ErrorSchema },
        },
      },
    },
  });

  const confirmRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{executionId}/confirm",
    tags: ["Treasury"],
    summary: "Confirm a treasury quote execution outcome",
    request: {
      params: QuoteExecutionIdParamsSchema,
      body: {
        content: {
          "application/json": { schema: ConfirmQuoteExecutionBodySchema },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Quote execution outcome recorded",
        content: {
          "application/json": { schema: QuoteExecutionResponseSchema },
        },
      },
      400: {
        description: "Validation or idempotency header error",
        content: {
          "application/json": { schema: ErrorSchema },
        },
      },
      404: {
        description: "Quote execution not found",
        content: {
          "application/json": { schema: ErrorSchema },
        },
      },
      409: {
        description: "Invalid state or idempotency conflict",
        content: {
          "application/json": { schema: ErrorSchema },
        },
      },
    },
  });

  const cancelRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{executionId}/cancel",
    tags: ["Treasury"],
    summary: "Cancel a treasury quote execution before submission",
    request: { params: QuoteExecutionIdParamsSchema },
    responses: {
      200: {
        description: "Quote execution cancelled",
        content: {
          "application/json": { schema: QuoteExecutionResponseSchema },
        },
      },
      400: {
        description: "Validation or idempotency header error",
        content: {
          "application/json": { schema: ErrorSchema },
        },
      },
      404: {
        description: "Quote execution not found",
        content: {
          "application/json": { schema: ErrorSchema },
        },
      },
      409: {
        description: "Invalid state or idempotency conflict",
        content: {
          "application/json": { schema: ErrorSchema },
        },
      },
    },
  });

  const expireRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{executionId}/expire",
    tags: ["Treasury"],
    summary: "Mark a treasury quote execution as expired before submission",
    request: { params: QuoteExecutionIdParamsSchema },
    responses: {
      200: {
        description: "Quote execution expired",
        content: {
          "application/json": { schema: QuoteExecutionResponseSchema },
        },
      },
      400: {
        description: "Validation or idempotency header error",
        content: {
          "application/json": { schema: ErrorSchema },
        },
      },
      404: {
        description: "Quote execution not found",
        content: {
          "application/json": { schema: ErrorSchema },
        },
      },
      409: {
        description: "Invalid state or idempotency conflict",
        content: {
          "application/json": { schema: ErrorSchema },
        },
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await ctx.treasuryModule.quoteExecutions.queries.list(
          query,
        );
        return c.json(
          {
            data: result.data.map(serializeQuoteExecution),
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
    .openapi(getRoute, async (c) => {
      try {
        const { executionId } = c.req.valid("param");
        const result =
          await ctx.treasuryModule.quoteExecutions.queries.findById({
            executionId,
          });
        if (!result) {
          return c.json(
            { code: "not_found", message: "Quote execution not found" },
            404,
          );
        }
        return c.json(serializeQuoteExecution(result), 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(submitRoute, async (c) => {
      try {
        const { executionId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await runIdempotentQuoteExecutionMutation(ctx, c, {
          action: "submit",
          request: { ...body, executionId },
          run: (quoteExecutions) =>
            quoteExecutions.commands.submit({
              executionId,
              providerRef: body.providerRef,
              providerSnapshot: body.providerSnapshot,
            }),
        });
        if (result instanceof Response) return result;
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(confirmRoute, async (c) => {
      try {
        const { executionId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await runIdempotentQuoteExecutionMutation(ctx, c, {
          action: "confirm",
          request: { ...body, executionId },
          run: (quoteExecutions) =>
            quoteExecutions.commands.confirm({
              executionId,
              failureReason: body.failureReason,
              outcome: body.outcome,
            }),
        });
        if (result instanceof Response) return result;
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(cancelRoute, async (c) => {
      try {
        const { executionId } = c.req.valid("param");
        const result = await runIdempotentQuoteExecutionMutation(ctx, c, {
          action: "cancel",
          request: { executionId },
          run: (quoteExecutions) =>
            quoteExecutions.commands.cancel({
              executionId,
            }),
        });
        if (result instanceof Response) return result;
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(expireRoute, async (c) => {
      try {
        const { executionId } = c.req.valid("param");
        const result = await runIdempotentQuoteExecutionMutation(ctx, c, {
          action: "expire",
          request: { executionId },
          run: (quoteExecutions) =>
            quoteExecutions.commands.expire({
              executionId,
            }),
        });
        if (result instanceof Response) return result;
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}

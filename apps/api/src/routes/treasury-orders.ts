import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import { ActionReceiptConflictError } from "@bedrock/platform/idempotency-postgres";
import type { Transaction } from "@bedrock/platform/persistence";
import type { TreasuryModule } from "@bedrock/treasury";
import {
  PaymentStepPartyRefSchema,
  PaymentStepRateLockedSideSchema,
  PaymentStepRateSchema,
  TreasuryOrderStateSchema,
  TreasuryOrderStepKindSchema,
  TreasuryOrderTypeSchema,
} from "@bedrock/treasury/contracts";

import { ErrorSchema } from "../common";
import { handleRouteError } from "../common/errors";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withRequiredIdempotency } from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

type TreasuryOrdersContext = Context<{ Variables: AuthVariables }>;
type TreasuryOrdersService = TreasuryModule["treasuryOrders"];

const TreasuryOrderIdParamsSchema = z.object({
  orderId: z.uuid(),
});

const PositiveMinorStringSchema = z
  .string()
  .regex(/^[1-9]\d*$/u, "Expected a positive minor-unit amount")
  .transform((value) => BigInt(value));

const OptionalMinorStringSchema = PositiveMinorStringSchema.nullable()
  .optional()
  .default(null);

const TreasuryOrderStepBodySchema = z.object({
  fromAmountMinor: OptionalMinorStringSchema,
  fromCurrencyId: z.uuid(),
  fromParty: PaymentStepPartyRefSchema,
  kind: TreasuryOrderStepKindSchema,
  quoteId: z.uuid().nullable().optional().default(null),
  rate: PaymentStepRateSchema.nullable().optional().default(null),
  toAmountMinor: OptionalMinorStringSchema,
  toCurrencyId: z.uuid(),
  toParty: PaymentStepPartyRefSchema,
});

const CreateTreasuryOrderBodySchema = z.object({
  description: z.string().trim().max(1000).nullable().optional().default(null),
  id: z.uuid().optional(),
  steps: z.array(TreasuryOrderStepBodySchema).min(1),
  type: TreasuryOrderTypeSchema,
});

const ListTreasuryOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  state: TreasuryOrderStateSchema.optional(),
  type: TreasuryOrderTypeSchema.optional(),
});

const TreasuryOrderStepResponseSchema = z.object({
  createdAt: z.iso.datetime(),
  fromAmountMinor: z.string().nullable(),
  fromCurrencyId: z.uuid(),
  fromParty: PaymentStepPartyRefSchema,
  id: z.uuid(),
  kind: TreasuryOrderStepKindSchema,
  paymentStepId: z.uuid().nullable(),
  quoteExecutionId: z.uuid().nullable(),
  quoteId: z.uuid().nullable(),
  rate: z
    .object({
      lockedSide: PaymentStepRateLockedSideSchema,
      value: z.string(),
    })
    .nullable(),
  sequence: z.number().int().positive(),
  sourceRef: z.string(),
  toAmountMinor: z.string().nullable(),
  toCurrencyId: z.uuid(),
  toParty: PaymentStepPartyRefSchema,
  updatedAt: z.iso.datetime(),
});

const TreasuryOrderResponseSchema = z.object({
  activatedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  description: z.string().nullable(),
  id: z.uuid(),
  state: TreasuryOrderStateSchema,
  steps: z.array(TreasuryOrderStepResponseSchema),
  type: TreasuryOrderTypeSchema,
  updatedAt: z.iso.datetime(),
});

const TreasuryOrdersListResponseSchema = z.object({
  data: z.array(TreasuryOrderResponseSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

type TreasuryOrderResponse = z.infer<typeof TreasuryOrderResponseSchema>;

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeNullableDate(value: Date | string | null): string | null {
  return value ? serializeDate(value) : null;
}

function serializeMinor(value: bigint | string | null): string | null {
  return value === null ? null : value.toString();
}

function serializeTreasuryOrder(order: {
  activatedAt: Date | string | null;
  cancelledAt: Date | string | null;
  createdAt: Date | string;
  description: string | null;
  id: string;
  state: z.infer<typeof TreasuryOrderStateSchema>;
  steps: Array<{
    createdAt: Date | string;
    fromAmountMinor: bigint | string | null;
    fromCurrencyId: string;
    fromParty: z.infer<typeof PaymentStepPartyRefSchema>;
    id: string;
    kind: z.infer<typeof TreasuryOrderStepKindSchema>;
    paymentStepId: string | null;
    quoteExecutionId: string | null;
    quoteId: string | null;
    rate: z.infer<typeof PaymentStepRateSchema> | null;
    sequence: number;
    sourceRef: string;
    toAmountMinor: bigint | string | null;
    toCurrencyId: string;
    toParty: z.infer<typeof PaymentStepPartyRefSchema>;
    updatedAt: Date | string;
  }>;
  type: z.infer<typeof TreasuryOrderTypeSchema>;
  updatedAt: Date | string;
}): TreasuryOrderResponse {
  return {
    ...order,
    activatedAt: serializeNullableDate(order.activatedAt),
    cancelledAt: serializeNullableDate(order.cancelledAt),
    createdAt: serializeDate(order.createdAt),
    steps: order.steps.map((step) => ({
      ...step,
      createdAt: serializeDate(step.createdAt),
      fromAmountMinor: serializeMinor(step.fromAmountMinor),
      toAmountMinor: serializeMinor(step.toAmountMinor),
      updatedAt: serializeDate(step.updatedAt),
    })),
    updatedAt: serializeDate(order.updatedAt),
  };
}

function resolveTreasuryOrdersService(
  ctx: AppContext,
  tx: Transaction,
): TreasuryOrdersService {
  return ctx.createTreasuryModule(tx).treasuryOrders;
}

async function runIdempotentOrderMutation<T>(
  ctx: AppContext,
  c: TreasuryOrdersContext,
  input: {
    action: string;
    request: Record<string, unknown>;
    run: (treasuryOrders: TreasuryOrdersService) => Promise<T>;
    serialize: (value: T) => TreasuryOrderResponse;
  },
): Promise<Response | TreasuryOrderResponse> {
  const scope = `treasury.orders.${input.action}`;
  return withRequiredIdempotency(c, (idempotencyKey) =>
    ctx.persistence.runInTransaction((tx) =>
      ctx.idempotency.withIdempotencyTx<
        TreasuryOrderResponse,
        TreasuryOrderResponse
      >({
        actorId: c.get("user")!.id,
        handler: async () =>
          input.serialize(await input.run(resolveTreasuryOrdersService(ctx, tx))),
        idempotencyKey,
        loadReplayResult: async ({ storedResult }) => {
          if (!storedResult) {
            throw new ActionReceiptConflictError(scope, idempotencyKey);
          }
          return storedResult;
        },
        request: input.request,
        scope,
        serializeResult: (order) => order,
        tx,
      }),
    ),
  );
}

export function treasuryOrdersRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const createOrderRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/",
    request: {
      body: {
        content: { "application/json": { schema: CreateTreasuryOrderBodySchema } },
        required: true,
      },
    },
    responses: {
      201: {
        description: "Treasury order created",
        content: { "application/json": { schema: TreasuryOrderResponseSchema } },
      },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorSchema } } },
      409: { description: "Conflict", content: { "application/json": { schema: ErrorSchema } } },
    },
    summary: "Create a treasury order",
    tags: ["Treasury"],
  });

  const listOrdersRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/",
    request: { query: ListTreasuryOrdersQuerySchema },
    responses: {
      200: {
        description: "Treasury orders",
        content: { "application/json": { schema: TreasuryOrdersListResponseSchema } },
      },
    },
    summary: "List treasury orders",
    tags: ["Treasury"],
  });

  const getOrderRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{orderId}",
    request: { params: TreasuryOrderIdParamsSchema },
    responses: {
      200: {
        description: "Treasury order",
        content: { "application/json": { schema: TreasuryOrderResponseSchema } },
      },
      404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
    },
    summary: "Get a treasury order",
    tags: ["Treasury"],
  });

  const activateOrderRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{orderId}/activate",
    request: { params: TreasuryOrderIdParamsSchema },
    responses: {
      200: {
        description: "Treasury order activated",
        content: { "application/json": { schema: TreasuryOrderResponseSchema } },
      },
      404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
      409: { description: "Conflict", content: { "application/json": { schema: ErrorSchema } } },
    },
    summary: "Activate a treasury order",
    tags: ["Treasury"],
  });

  const cancelOrderRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{orderId}/cancel",
    request: { params: TreasuryOrderIdParamsSchema },
    responses: {
      200: {
        description: "Treasury order cancelled",
        content: { "application/json": { schema: TreasuryOrderResponseSchema } },
      },
      404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
      409: { description: "Conflict", content: { "application/json": { schema: ErrorSchema } } },
    },
    summary: "Cancel a treasury order",
    tags: ["Treasury"],
  });

  return app
    .openapi(createOrderRoute, async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await runIdempotentOrderMutation(ctx, c, {
          action: "create",
          request: { body },
          run: (treasuryOrders) => treasuryOrders.commands.create(body),
          serialize: serializeTreasuryOrder,
        });
        return result instanceof Response ? result : c.json(result, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listOrdersRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await ctx.treasuryModule.treasuryOrders.queries.list(query);
        return c.json({
          data: result.data.map(serializeTreasuryOrder),
          limit: result.limit,
          offset: result.offset,
          total: result.total,
        });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getOrderRoute, async (c) => {
      try {
        const { orderId } = c.req.valid("param");
        const order = await ctx.treasuryModule.treasuryOrders.queries.findById({
          orderId,
        });
        return order
          ? c.json(serializeTreasuryOrder(order), 200)
          : c.json({ error: `Treasury order ${orderId} not found` }, 404);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(activateOrderRoute, async (c) => {
      try {
        const { orderId } = c.req.valid("param");
        const result = await runIdempotentOrderMutation(ctx, c, {
          action: "activate",
          request: { orderId },
          run: (treasuryOrders) =>
            treasuryOrders.commands.activate({ orderId }),
          serialize: serializeTreasuryOrder,
        });
        return result instanceof Response ? result : c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(cancelOrderRoute, async (c) => {
      try {
        const { orderId } = c.req.valid("param");
        const result = await runIdempotentOrderMutation(ctx, c, {
          action: "cancel",
          request: { orderId },
          run: (treasuryOrders) =>
            treasuryOrders.commands.cancel({ orderId }),
          serialize: serializeTreasuryOrder,
        });
        return result instanceof Response ? result : c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}

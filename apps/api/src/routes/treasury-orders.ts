import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import { ActionReceiptConflictError } from "@bedrock/platform/idempotency-postgres";
import type { Transaction } from "@bedrock/platform/persistence";
import type { TreasuryModule } from "@bedrock/treasury";
import {
  PaymentStepPartyRefSchema,
  PaymentStepRateLockedSideSchema,
  PaymentStepRateSchema,
  TreasuryInventoryAllocationSchema,
  TreasuryInventoryAllocationStateSchema,
  TreasuryInventoryPositionSchema,
  TreasuryInventoryPositionStateSchema,
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

const TreasuryInventoryPositionIdParamsSchema = z.object({
  positionId: z.uuid(),
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

const ListInventoryPositionsQuerySchema = z.object({
  currencyId: z.uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  ownerPartyId: z.uuid().optional(),
  sourceOrderId: z.uuid().optional(),
  sourceQuoteExecutionId: z.uuid().optional(),
  state: TreasuryInventoryPositionStateSchema.optional(),
});

const ListInventoryAllocationsQuerySchema = z.object({
  dealId: z.uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  positionId: z.uuid().optional(),
  quoteId: z.uuid().optional(),
  state: TreasuryInventoryAllocationStateSchema.optional(),
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

const TreasuryInventoryPositionResponseSchema =
  TreasuryInventoryPositionSchema.extend({
    acquiredAmountMinor: z.string(),
    availableAmountMinor: z.string(),
    costAmountMinor: z.string(),
    createdAt: z.iso.datetime(),
    ledger: z.object({
      currency: z.string(),
      inventoryAcquiredMinor: z.string(),
      inventoryAvailableMinor: z.string(),
      inventoryReservedMinor: z.string(),
      ledgerAvailableMinor: z.string(),
      ledgerBalanceMinor: z.string(),
      ledgerReservedMinor: z.string(),
      reconciliationStatus: z.enum([
        "matched",
        "inventory_exceeds_balance",
        "missing_balance",
      ]),
      subject: z.object({
        bookId: z.uuid(),
        currency: z.string(),
        subjectId: z.string(),
        subjectType: z.string(),
      }),
    }),
    ledgerSubjectType: z.literal("organization_requisite"),
    ownerBookId: z.uuid(),
    sourcePostingDocumentId: z.uuid(),
    sourcePostingDocumentKind: z.literal("fx_execute"),
    updatedAt: z.iso.datetime(),
  });

const TreasuryInventoryPositionsListResponseSchema = z.object({
  data: z.array(TreasuryInventoryPositionResponseSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

const TreasuryInventoryAllocationResponseSchema =
  TreasuryInventoryAllocationSchema.extend({
    amountMinor: z.string(),
    costAmountMinor: z.string(),
    consumedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    reservedAt: z.iso.datetime(),
    releasedAt: z.iso.datetime().nullable(),
    updatedAt: z.iso.datetime(),
  });

const TreasuryInventoryAllocationsListResponseSchema = z.object({
  data: z.array(TreasuryInventoryAllocationResponseSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

type TreasuryOrderResponse = z.infer<typeof TreasuryOrderResponseSchema>;
type TreasuryInventoryPositionResponse = z.infer<
  typeof TreasuryInventoryPositionResponseSchema
>;
type TreasuryInventoryAllocationResponse = z.infer<
  typeof TreasuryInventoryAllocationResponseSchema
>;

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
  steps: {
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
  }[];
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

async function buildInventoryLedgerBlock(
  ctx: AppContext,
  position: {
    acquiredAmountMinor: bigint | string;
    availableAmountMinor: bigint | string;
    currencyId: string;
    id: string;
    ledgerSubjectType: "organization_requisite";
    ownerBookId: string;
    ownerRequisiteId: string;
  },
) {
  const currency = await ctx.currenciesService.findById(position.currencyId);
  const balance = await ctx.ledgerModule.balances.queries.getBalance({
    bookId: position.ownerBookId,
    currency: currency.code,
    subjectId: position.ownerRequisiteId,
    subjectType: position.ledgerSubjectType,
  });
  const allocations =
    await ctx.treasuryModule.treasuryOrders.queries.listInventoryAllocations({
      limit: 100,
      offset: 0,
      positionId: position.id,
      state: "reserved",
    });
  const inventoryReserved = allocations.data.reduce(
    (sum, allocation) => sum + allocation.amountMinor,
    0n,
  );
  const inventoryAvailable = BigInt(position.availableAmountMinor.toString());
  const inventoryAcquired = BigInt(position.acquiredAmountMinor.toString());
  const reconciliationStatus =
    balance.ledgerBalance === 0n && inventoryAcquired > 0n
      ? ("missing_balance" as const)
      : inventoryAvailable > balance.available
        ? ("inventory_exceeds_balance" as const)
        : ("matched" as const);

  return {
    currency: currency.code,
    inventoryAcquiredMinor: inventoryAcquired.toString(),
    inventoryAvailableMinor: inventoryAvailable.toString(),
    inventoryReservedMinor: inventoryReserved.toString(),
    ledgerAvailableMinor: balance.available.toString(),
    ledgerBalanceMinor: balance.ledgerBalance.toString(),
    ledgerReservedMinor: balance.reserved.toString(),
    reconciliationStatus,
    subject: {
      bookId: balance.bookId,
      currency: balance.currency,
      subjectId: balance.subjectId,
      subjectType: balance.subjectType,
    },
  };
}

async function serializeInventoryPosition(ctx: AppContext, position: {
  acquiredAmountMinor: bigint | string;
  availableAmountMinor: bigint | string;
  costAmountMinor: bigint | string;
  costCurrencyId: string;
  createdAt: Date | string;
  currencyId: string;
  id: string;
  ledgerSubjectType: "organization_requisite";
  ownerBookId: string;
  ownerPartyId: string;
  ownerRequisiteId: string;
  sourceOrderId: string;
  sourcePostingDocumentId: string;
  sourcePostingDocumentKind: "fx_execute";
  sourceQuoteExecutionId: string;
  state: z.infer<typeof TreasuryInventoryPositionStateSchema>;
  updatedAt: Date | string;
}): Promise<TreasuryInventoryPositionResponse> {
  return {
    ...position,
    acquiredAmountMinor: position.acquiredAmountMinor.toString(),
    availableAmountMinor: position.availableAmountMinor.toString(),
    costAmountMinor: position.costAmountMinor.toString(),
    createdAt: serializeDate(position.createdAt),
    ledger: await buildInventoryLedgerBlock(ctx, position),
    updatedAt: serializeDate(position.updatedAt),
  };
}

function serializeInventoryAllocation(allocation: {
  amountMinor: bigint | string;
  costAmountMinor: bigint | string;
  consumedAt: Date | string | null;
  createdAt: Date | string;
  dealId: string;
  id: string;
  ledgerHoldRef: string;
  ownerBookId: string;
  ownerRequisiteId: string;
  currencyId: string;
  positionId: string;
  quoteId: string | null;
  releasedAt: Date | string | null;
  reservedAt: Date | string;
  state: z.infer<typeof TreasuryInventoryAllocationStateSchema>;
  updatedAt: Date | string;
}): TreasuryInventoryAllocationResponse {
  return {
    ...allocation,
    amountMinor: allocation.amountMinor.toString(),
    costAmountMinor: allocation.costAmountMinor.toString(),
    consumedAt: serializeNullableDate(allocation.consumedAt),
    createdAt: serializeDate(allocation.createdAt),
    releasedAt: serializeNullableDate(allocation.releasedAt),
    reservedAt: serializeDate(allocation.reservedAt),
    updatedAt: serializeDate(allocation.updatedAt),
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

  const listInventoryPositionsRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/inventory/positions",
    request: { query: ListInventoryPositionsQuerySchema },
    responses: {
      200: {
        description: "Treasury inventory positions",
        content: {
          "application/json": {
            schema: TreasuryInventoryPositionsListResponseSchema,
          },
        },
      },
    },
    summary: "List treasury inventory positions",
    tags: ["Treasury"],
  });

  const getInventoryPositionRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/inventory/positions/{positionId}",
    request: { params: TreasuryInventoryPositionIdParamsSchema },
    responses: {
      200: {
        description: "Treasury inventory position",
        content: {
          "application/json": {
            schema: TreasuryInventoryPositionResponseSchema,
          },
        },
      },
      404: {
        description: "Not found",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
    summary: "Get a treasury inventory position",
    tags: ["Treasury"],
  });

  const listInventoryAllocationsRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/inventory/allocations",
    request: { query: ListInventoryAllocationsQuerySchema },
    responses: {
      200: {
        description: "Treasury inventory allocations",
        content: {
          "application/json": {
            schema: TreasuryInventoryAllocationsListResponseSchema,
          },
        },
      },
    },
    summary: "List treasury inventory allocations",
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
    .openapi(listInventoryPositionsRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result =
          await ctx.treasuryModule.treasuryOrders.queries.listInventoryPositions(
            query,
          );
        return c.json({
          data: await Promise.all(
            result.data.map((position) =>
              serializeInventoryPosition(ctx, position),
            ),
          ),
          limit: result.limit,
          offset: result.offset,
          total: result.total,
        });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getInventoryPositionRoute, async (c) => {
      try {
        const { positionId } = c.req.valid("param");
        const position =
          await ctx.treasuryModule.treasuryOrders.queries.findInventoryPositionById(
            { positionId },
          );
        return position
          ? c.json(await serializeInventoryPosition(ctx, position), 200)
          : c.json(
              { error: `Treasury inventory position ${positionId} not found` },
              404,
            );
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listInventoryAllocationsRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result =
          await ctx.treasuryModule.treasuryOrders.queries.listInventoryAllocations(
            query,
          );
        return c.json({
          data: result.data.map(serializeInventoryAllocation),
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

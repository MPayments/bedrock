import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  AmountMismatchError,
  CurrencyMismatchError,
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from "@bedrock/treasury";

import { ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const amountMinorSchema = z
  .string()
  .regex(/^[0-9]+$/, "amountMinor must be a non-negative integer string")
  .transform((value) => BigInt(value));

const occurredAtSchema = z
  .string()
  .datetime()
  .transform((value) => new Date(value));

const fundingSettledBodySchema = z.object({
  orderId: z.uuid(),
  branchCounterpartyId: z.uuid(),
  branchBankStableKey: z.string().min(1),
  customerId: z.uuid(),
  currency: z.string().min(2).max(16),
  amountMinor: amountMinorSchema,
  railRef: z.string().min(1).max(255),
  occurredAt: occurredAtSchema,
});

const executeFxFeeSchema = z.object({
  id: z.string().min(1).max(128).optional(),
  kind: z.string().min(1).max(64),
  currency: z.string().min(2).max(16),
  amountMinor: amountMinorSchema,
  settlementMode: z.enum(["in_ledger", "separate_payment_order"]).optional(),
  accountingTreatment: z.enum(["income", "pass_through", "expense"]).optional(),
  memo: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.string().max(255)).optional(),
});

const executeFxAdjustmentSchema = z.object({
  id: z.string().min(1).max(128).optional(),
  kind: z.string().min(1).max(64),
  effect: z.enum(["increase_charge", "decrease_charge"]),
  currency: z.string().min(2).max(16),
  amountMinor: amountMinorSchema,
  settlementMode: z.enum(["in_ledger", "separate_payment_order"]).optional(),
  memo: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.string().max(255)).optional(),
});

const executeFxBodySchema = z.object({
  orderId: z.uuid(),
  branchCounterpartyId: z.uuid(),
  customerId: z.uuid(),
  dealDirection: z
    .enum([
      "cash_to_wire",
      "wire_to_cash",
      "wire_to_wire",
      "usdt_to_cash",
      "cash_to_usdt",
      "other",
    ])
    .optional(),
  dealForm: z.enum(["conversion", "transit"]).optional(),
  payInCurrency: z.string().min(2).max(16),
  principalMinor: amountMinorSchema,
  fees: z.array(executeFxFeeSchema).optional().default([]),
  adjustments: z.array(executeFxAdjustmentSchema).optional().default([]),
  payOutCurrency: z.string().min(2).max(16),
  payOutAmountMinor: amountMinorSchema,
  occurredAt: occurredAtSchema,
  quoteRef: z.string().min(1).max(255),
});

const initiatePayoutBodySchema = z.object({
  orderId: z.uuid(),
  payoutCounterpartyId: z.uuid(),
  payoutBankStableKey: z.string().min(1),
  payOutCurrency: z.string().min(2).max(16),
  amountMinor: amountMinorSchema,
  railRef: z.string().min(1).max(255),
  timeoutSeconds: z.number().int().positive().optional(),
  occurredAt: occurredAtSchema,
});

const settlePayoutBodySchema = z.object({
  orderId: z.uuid(),
  payOutCurrency: z.string().min(2).max(16),
  railRef: z.string().min(1).max(255),
  occurredAt: occurredAtSchema,
});

const voidPayoutBodySchema = settlePayoutBodySchema;

const initiateFeePaymentBodySchema = z.object({
  feePaymentOrderId: z.uuid(),
  payoutCounterpartyId: z.uuid(),
  payoutOperationalAccountId: z.uuid(),
  railRef: z.string().min(1).max(255),
  timeoutSeconds: z.number().int().positive().optional(),
  occurredAt: occurredAtSchema,
});

const settleFeePaymentBodySchema = z.object({
  feePaymentOrderId: z.uuid(),
  railRef: z.string().min(1).max(255),
  occurredAt: occurredAtSchema,
});

const voidFeePaymentBodySchema = settleFeePaymentBodySchema;

const operationAcceptedSchema = z.object({
  entryId: z.uuid(),
});

const pendingOperationAcceptedSchema = z.object({
  entryId: z.uuid(),
  pendingTransferId: z.string(),
});

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function handleTreasuryError(error: unknown) {
  if (error instanceof NotFoundError) {
    return { status: 404 as const, body: { error: toErrorMessage(error) } };
  }

  if (error instanceof InvalidStateError) {
    return { status: 409 as const, body: { error: toErrorMessage(error) } };
  }

  if (
    error instanceof ValidationError ||
    error instanceof AmountMismatchError ||
    error instanceof CurrencyMismatchError
  ) {
    return { status: 400 as const, body: { error: toErrorMessage(error) } };
  }

  return null;
}

export function treasuryRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const middleware = [requirePermission({ accounting: ["list"] })];

  const fundingSettledRoute = createRoute({
    middleware,
    method: "post",
    path: "/funding/settled",
    tags: ["Treasury"],
    summary: "Mark funding as settled and create treasury ledger operation",
    request: {
      body: {
        content: {
          "application/json": {
            schema: fundingSettledBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: operationAcceptedSchema,
          },
        },
        description: "Funding settled operation accepted",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Order not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Invalid state transition",
      },
    },
  });

  const executeFxRoute = createRoute({
    middleware,
    method: "post",
    path: "/fx/execute",
    tags: ["Treasury"],
    summary: "Execute FX for payment order and reserve obligations",
    request: {
      body: {
        content: {
          "application/json": {
            schema: executeFxBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: operationAcceptedSchema,
          },
        },
        description: "FX execution operation accepted",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Order not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Invalid state transition",
      },
    },
  });

  const initiatePayoutRoute = createRoute({
    middleware,
    method: "post",
    path: "/payouts/initiate",
    tags: ["Treasury"],
    summary: "Initiate outbound payout as pending transfer",
    request: {
      body: {
        content: {
          "application/json": {
            schema: initiatePayoutBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: pendingOperationAcceptedSchema,
          },
        },
        description: "Payout initiated",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Order not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Invalid state transition",
      },
    },
  });

  const settlePayoutRoute = createRoute({
    middleware,
    method: "post",
    path: "/payouts/settle",
    tags: ["Treasury"],
    summary: "Settle pending payout transfer",
    request: {
      body: {
        content: {
          "application/json": {
            schema: settlePayoutBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: operationAcceptedSchema,
          },
        },
        description: "Payout settled",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Order not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Invalid state transition",
      },
    },
  });

  const voidPayoutRoute = createRoute({
    middleware,
    method: "post",
    path: "/payouts/void",
    tags: ["Treasury"],
    summary: "Void pending payout transfer",
    request: {
      body: {
        content: {
          "application/json": {
            schema: voidPayoutBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: operationAcceptedSchema,
          },
        },
        description: "Payout voided",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Order not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Invalid state transition",
      },
    },
  });

  const initiateFeePaymentRoute = createRoute({
    middleware,
    method: "post",
    path: "/fee-payments/initiate",
    tags: ["Treasury"],
    summary: "Initiate fee payment as pending transfer",
    request: {
      body: {
        content: {
          "application/json": {
            schema: initiateFeePaymentBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: pendingOperationAcceptedSchema,
          },
        },
        description: "Fee payment initiated",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Order not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Invalid state transition",
      },
    },
  });

  const settleFeePaymentRoute = createRoute({
    middleware,
    method: "post",
    path: "/fee-payments/settle",
    tags: ["Treasury"],
    summary: "Settle pending fee payment transfer",
    request: {
      body: {
        content: {
          "application/json": {
            schema: settleFeePaymentBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: operationAcceptedSchema,
          },
        },
        description: "Fee payment settled",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Order not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Invalid state transition",
      },
    },
  });

  const voidFeePaymentRoute = createRoute({
    middleware,
    method: "post",
    path: "/fee-payments/void",
    tags: ["Treasury"],
    summary: "Void pending fee payment transfer",
    request: {
      body: {
        content: {
          "application/json": {
            schema: voidFeePaymentBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: operationAcceptedSchema,
          },
        },
        description: "Fee payment voided",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Order not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Invalid state transition",
      },
    },
  });

  return app
    .openapi(fundingSettledRoute, async (c) => {
      try {
        const input = c.req.valid("json");
        const entryId = await ctx.treasuryService.fundingSettled(input);
        return c.json({ entryId }, 200);
      } catch (error) {
        const handled = handleTreasuryError(error);
        if (handled) return c.json(handled.body, handled.status);
        throw error;
      }
    })
    .openapi(executeFxRoute, async (c) => {
      try {
        const input = c.req.valid("json");
        const entryId = await ctx.treasuryService.executeFx(input);
        return c.json({ entryId }, 200);
      } catch (error) {
        const handled = handleTreasuryError(error);
        if (handled) return c.json(handled.body, handled.status);
        throw error;
      }
    })
    .openapi(initiatePayoutRoute, async (c) => {
      try {
        const input = c.req.valid("json");
        const result = await ctx.treasuryService.initiatePayout(input);
        return c.json(
          {
            entryId: result.entryId,
            pendingTransferId: result.pendingTransferId.toString(),
          },
          200,
        );
      } catch (error) {
        const handled = handleTreasuryError(error);
        if (handled) return c.json(handled.body, handled.status);
        throw error;
      }
    })
    .openapi(settlePayoutRoute, async (c) => {
      try {
        const input = c.req.valid("json");
        const entryId = await ctx.treasuryService.settlePayout(input);
        return c.json({ entryId }, 200);
      } catch (error) {
        const handled = handleTreasuryError(error);
        if (handled) return c.json(handled.body, handled.status);
        throw error;
      }
    })
    .openapi(voidPayoutRoute, async (c) => {
      try {
        const input = c.req.valid("json");
        const entryId = await ctx.treasuryService.voidPayout(input);
        return c.json({ entryId }, 200);
      } catch (error) {
        const handled = handleTreasuryError(error);
        if (handled) return c.json(handled.body, handled.status);
        throw error;
      }
    })
    .openapi(initiateFeePaymentRoute, async (c) => {
      try {
        const input = c.req.valid("json");
        const result = await ctx.treasuryService.initiateFeePayment(input);
        if (!result.entryId || !result.pendingTransferId) {
          throw new InvalidStateError(
            "Fee payment initiate result is missing operation linkage",
          );
        }
        return c.json(
          {
            entryId: result.entryId,
            pendingTransferId: result.pendingTransferId.toString(),
          },
          200,
        );
      } catch (error) {
        const handled = handleTreasuryError(error);
        if (handled) return c.json(handled.body, handled.status);
        throw error;
      }
    })
    .openapi(settleFeePaymentRoute, async (c) => {
      try {
        const input = c.req.valid("json");
        const entryId = await ctx.treasuryService.settleFeePayment(input);
        return c.json({ entryId }, 200);
      } catch (error) {
        const handled = handleTreasuryError(error);
        if (handled) return c.json(handled.body, handled.status);
        throw error;
      }
    })
    .openapi(voidFeePaymentRoute, async (c) => {
      try {
        const input = c.req.valid("json");
        const entryId = await ctx.treasuryService.voidFeePayment(input);
        return c.json({ entryId }, 200);
      } catch (error) {
        const handled = handleTreasuryError(error);
        if (handled) return c.json(handled.body, handled.status);
        throw error;
      }
    });
}

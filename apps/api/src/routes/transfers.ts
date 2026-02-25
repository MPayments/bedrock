import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  ApproveTransferInputSchema,
  CreateTransferDraftInputSchema,
  InvalidStateError,
  ListTransfersQuerySchema,
  MakerCheckerViolationError,
  NotFoundError,
  PermissionError,
  RejectTransferInputSchema,
  SettlePendingTransferInputSchema,
  TransferCurrencyMismatchError,
  TransferKindSchema,
  TransferSettlementModeSchema,
  TransferStatusSchema,
  ValidationError,
  VoidPendingTransferInputSchema,
} from "@bedrock/transfers";
import { createPaginatedListSchema } from "@bedrock/kernel/pagination";

import { ErrorSchema, IdParamSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const TransferOrderResponseSchema = z.object({
  id: z.uuid(),
  sourceCounterpartyId: z.uuid(),
  destinationCounterpartyId: z.uuid(),
  sourceAccountId: z.uuid(),
  destinationAccountId: z.uuid(),
  currencyId: z.uuid(),
  amountMinor: z.string(),
  kind: TransferKindSchema,
  settlementMode: TransferSettlementModeSchema,
  timeoutSeconds: z.number().int(),
  status: TransferStatusSchema,
  memo: z.string().nullable(),
  makerUserId: z.uuid(),
  checkerUserId: z.uuid().nullable(),
  approvedAt: z.string().datetime().nullable(),
  rejectedAt: z.string().datetime().nullable(),
  rejectReason: z.string().nullable(),
  ledgerEntryId: z.uuid().nullable(),
  pendingTransferId: z.string().nullable(),
  idempotencyKey: z.string(),
  lastError: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const TransferDraftCreatedSchema = z.object({
  transferId: z.uuid(),
});

const TransferActionResultSchema = z.object({
  transferId: z.uuid(),
  ledgerEntryId: z.uuid(),
});

const TransferRejectedSchema = z.object({
  transferId: z.uuid(),
});

const PaginatedTransfersSchema = createPaginatedListSchema(
  TransferOrderResponseSchema,
);

function toTransferDto(transfer: any) {
  return {
    id: transfer.id,
    sourceCounterpartyId: transfer.sourceCounterpartyId,
    destinationCounterpartyId: transfer.destinationCounterpartyId,
    sourceAccountId: transfer.sourceAccountId,
    destinationAccountId: transfer.destinationAccountId,
    currencyId: transfer.currencyId,
    amountMinor: transfer.amountMinor.toString(),
    kind: transfer.kind,
    settlementMode: transfer.settlementMode,
    timeoutSeconds: transfer.timeoutSeconds,
    status: transfer.status,
    memo: transfer.memo,
    makerUserId: transfer.makerUserId,
    checkerUserId: transfer.checkerUserId,
    approvedAt: transfer.approvedAt?.toISOString() ?? null,
    rejectedAt: transfer.rejectedAt?.toISOString() ?? null,
    rejectReason: transfer.rejectReason,
    ledgerEntryId: transfer.ledgerEntryId,
    pendingTransferId: transfer.pendingTransferId?.toString() ?? null,
    idempotencyKey: transfer.idempotencyKey,
    lastError: transfer.lastError,
    createdAt: transfer.createdAt.toISOString(),
    updatedAt: transfer.updatedAt.toISOString(),
  };
}

function handleTransferError(err: unknown) {
  if (err instanceof NotFoundError) {
    return { status: 404 as const, body: { error: err.message } };
  }
  if (err instanceof PermissionError) {
    return { status: 403 as const, body: { error: err.message } };
  }
  if (err instanceof InvalidStateError) {
    return { status: 409 as const, body: { error: err.message } };
  }
  if (
    err instanceof ValidationError ||
    err instanceof MakerCheckerViolationError ||
    err instanceof TransferCurrencyMismatchError
  ) {
    return { status: 400 as const, body: { error: err.message } };
  }

  return null;
}

export function transfersRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ transfers: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Transfers"],
    summary: "List transfer orders",
    request: {
      query: ListTransfersQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedTransfersSchema,
          },
        },
        description: "Paginated transfer orders",
      },
    },
  });

  const createDraftRoute = createRoute({
    middleware: [requirePermission({ transfers: ["create"] })],
    method: "post",
    path: "/drafts",
    tags: ["Transfers"],
    summary: "Create transfer draft",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateTransferDraftInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: TransferDraftCreatedSchema,
          },
        },
        description: "Draft created",
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
        description: "Account not found",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ transfers: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Transfers"],
    summary: "Get transfer by ID",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: TransferOrderResponseSchema,
          },
        },
        description: "Transfer found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Transfer not found",
      },
    },
  });

  const approveRoute = createRoute({
    middleware: [requirePermission({ transfers: ["approve"] })],
    method: "post",
    path: "/{id}/approve",
    tags: ["Transfers"],
    summary: "Approve transfer draft",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: ApproveTransferInputSchema.omit({ transferId: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: TransferActionResultSchema,
          },
        },
        description: "Transfer approved",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      403: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Forbidden",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Transfer not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Invalid state transition",
      },
    },
  });

  const rejectRoute = createRoute({
    middleware: [requirePermission({ transfers: ["reject"] })],
    method: "post",
    path: "/{id}/reject",
    tags: ["Transfers"],
    summary: "Reject transfer draft",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: RejectTransferInputSchema.omit({ transferId: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: TransferRejectedSchema,
          },
        },
        description: "Transfer rejected",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      403: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Forbidden",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Transfer not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Invalid state transition",
      },
    },
  });

  const settleRoute = createRoute({
    middleware: [requirePermission({ transfers: ["settle"] })],
    method: "post",
    path: "/{id}/settle",
    tags: ["Transfers"],
    summary: "Settle pending transfer",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: SettlePendingTransferInputSchema.omit({ transferId: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: TransferActionResultSchema,
          },
        },
        description: "Pending transfer settled",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      403: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Forbidden",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Transfer not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Invalid state transition",
      },
    },
  });

  const voidRoute = createRoute({
    middleware: [requirePermission({ transfers: ["void"] })],
    method: "post",
    path: "/{id}/void",
    tags: ["Transfers"],
    summary: "Void pending transfer",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: VoidPendingTransferInputSchema.omit({ transferId: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: TransferActionResultSchema,
          },
        },
        description: "Pending transfer voided",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Validation error",
      },
      403: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Forbidden",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Transfer not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Invalid state transition",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.transfersService.list(query);
      return c.json({
        ...result,
        data: result.data.map(toTransferDto),
      }, 200);
    })
    .openapi(createDraftRoute, async (c) => {
      const input = c.req.valid("json");
      try {
        const transferId = await ctx.transfersService.createDraft(input);
        return c.json({ transferId }, 201);
      } catch (err) {
        if (err instanceof NotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        if (
          err instanceof ValidationError ||
          err instanceof MakerCheckerViolationError ||
          err instanceof TransferCurrencyMismatchError
        ) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      try {
        const transfer = await ctx.transfersService.get(id);
        return c.json(toTransferDto(transfer), 200);
      } catch (err) {
        if (err instanceof NotFoundError) {
          return c.json({ error: err.message }, 404);
        }
        throw err;
      }
    })
    .openapi(approveRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        const result = await ctx.transfersService.approve({
          transferId: id,
          ...input,
        });
        return c.json(result, 200);
      } catch (err) {
        const handled = handleTransferError(err);
        if (handled) return c.json(handled.body, handled.status);
        throw err;
      }
    })
    .openapi(rejectRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        const transferId = await ctx.transfersService.reject({
          transferId: id,
          ...input,
        });
        return c.json({ transferId }, 200);
      } catch (err) {
        const handled = handleTransferError(err);
        if (handled) return c.json(handled.body, handled.status);
        throw err;
      }
    })
    .openapi(settleRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        const result = await ctx.transfersService.settlePending({
          transferId: id,
          ...input,
        });
        return c.json(result, 200);
      } catch (err) {
        const handled = handleTransferError(err);
        if (handled) return c.json(handled.body, handled.status);
        throw err;
      }
    })
    .openapi(voidRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        const result = await ctx.transfersService.voidPending({
          transferId: id,
          ...input,
        });
        return c.json(result, 200);
      } catch (err) {
        const handled = handleTransferError(err);
        if (handled) return c.json(handled.body, handled.status);
        throw err;
      }
    });
}

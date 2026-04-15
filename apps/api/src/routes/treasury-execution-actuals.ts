import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import {
  ListTreasuryCashMovementsQuerySchema,
  ListTreasuryExecutionFeesQuerySchema,
  ListTreasuryExecutionFillsQuerySchema,
  TreasuryCashMovementDirectionSchema,
  TreasuryCashMovementListResponseSchema,
  TreasuryCashMovementSchema,
  TreasuryExecutionFeeListResponseSchema,
  TreasuryExecutionFeeSchema,
  TreasuryExecutionFillListResponseSchema,
  TreasuryExecutionFillSchema,
  TreasuryOperationFactSourceKindSchema,
} from "@bedrock/treasury/contracts";

import { ErrorSchema } from "../common";
import { handleRouteError } from "../common/errors";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withRequiredIdempotency } from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

const OperationIdParamsSchema = z.object({
  operationId: z.uuid(),
});

const MinorAmountStringSchema = z
  .string()
  .trim()
  .regex(/^-?\d+$/)
  .nullable()
  .optional()
  .default(null);

const OptionalDateTimeSchema = z.iso.datetime().nullable().optional().default(null);
const OptionalUuidSchema = z.uuid().nullable().optional().default(null);
const OptionalShortTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .nullable()
  .optional()
  .default(null);

const TreasuryExecutionFillBodySchema = z.object({
  actualRateDen: MinorAmountStringSchema,
  actualRateNum: MinorAmountStringSchema,
  boughtAmountMinor: MinorAmountStringSchema,
  boughtCurrencyId: OptionalUuidSchema,
  calculationSnapshotId: OptionalUuidSchema,
  confirmedAt: OptionalDateTimeSchema,
  executedAt: OptionalDateTimeSchema,
  externalRecordId: OptionalShortTextSchema,
  fillSequence: z.number().int().positive().nullable().optional().default(null),
  instructionId: OptionalUuidSchema,
  metadata: z.record(z.string(), z.unknown()).nullable().optional().default(null),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
  providerCounterpartyId: OptionalUuidSchema,
  providerRef: OptionalShortTextSchema,
  routeLegId: OptionalUuidSchema,
  routeVersionId: OptionalUuidSchema,
  soldAmountMinor: MinorAmountStringSchema,
  soldCurrencyId: OptionalUuidSchema,
  sourceKind: TreasuryOperationFactSourceKindSchema,
});

const TreasuryExecutionFeeBodySchema = z.object({
  amountMinor: MinorAmountStringSchema,
  calculationSnapshotId: OptionalUuidSchema,
  chargedAt: OptionalDateTimeSchema,
  componentCode: OptionalShortTextSchema,
  confirmedAt: OptionalDateTimeSchema,
  currencyId: OptionalUuidSchema,
  externalRecordId: OptionalShortTextSchema,
  feeFamily: z.string().trim().min(1).max(64),
  fillId: OptionalUuidSchema,
  instructionId: OptionalUuidSchema,
  metadata: z.record(z.string(), z.unknown()).nullable().optional().default(null),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
  providerCounterpartyId: OptionalUuidSchema,
  providerRef: OptionalShortTextSchema,
  routeComponentId: OptionalUuidSchema,
  routeLegId: OptionalUuidSchema,
  routeVersionId: OptionalUuidSchema,
  sourceKind: TreasuryOperationFactSourceKindSchema,
});

const TreasuryCashMovementBodySchema = z.object({
  accountRef: OptionalShortTextSchema,
  amountMinor: MinorAmountStringSchema,
  bookedAt: OptionalDateTimeSchema,
  calculationSnapshotId: OptionalUuidSchema,
  confirmedAt: OptionalDateTimeSchema,
  currencyId: OptionalUuidSchema,
  direction: TreasuryCashMovementDirectionSchema,
  externalRecordId: OptionalShortTextSchema,
  instructionId: OptionalUuidSchema,
  metadata: z.record(z.string(), z.unknown()).nullable().optional().default(null),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
  providerCounterpartyId: OptionalUuidSchema,
  providerRef: OptionalShortTextSchema,
  requisiteId: OptionalUuidSchema,
  routeLegId: OptionalUuidSchema,
  routeVersionId: OptionalUuidSchema,
  sourceKind: TreasuryOperationFactSourceKindSchema,
  statementRef: OptionalShortTextSchema,
  valueDate: OptionalDateTimeSchema,
});

function parseMinorAmount(value: string | null) {
  return value === null ? null : BigInt(value);
}

function parseDateTime(value: string | null) {
  return value ? new Date(value) : null;
}

export function treasuryExecutionActualsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listFillsRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/execution-fills",
    tags: ["Treasury"],
    summary: "List treasury execution fills by operation, deal, or route leg",
    request: {
      query: ListTreasuryExecutionFillsQuerySchema,
    },
    responses: {
      200: {
        description: "Paginated treasury execution fills",
        content: {
          "application/json": {
            schema: TreasuryExecutionFillListResponseSchema,
          },
        },
      },
    },
  });

  const createFillRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/operations/{operationId}/fills",
    tags: ["Treasury"],
    summary: "Record an execution fill for a treasury operation",
    request: {
      params: OperationIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: TreasuryExecutionFillBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Recorded treasury execution fill",
        content: {
          "application/json": {
            schema: TreasuryExecutionFillSchema,
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
        description: "Operation not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const listFeesRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/execution-fees",
    tags: ["Treasury"],
    summary: "List treasury execution fees by operation, deal, or route leg",
    request: {
      query: ListTreasuryExecutionFeesQuerySchema,
    },
    responses: {
      200: {
        description: "Paginated treasury execution fees",
        content: {
          "application/json": {
            schema: TreasuryExecutionFeeListResponseSchema,
          },
        },
      },
    },
  });

  const createFeeRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/operations/{operationId}/fees",
    tags: ["Treasury"],
    summary: "Record an execution fee for a treasury operation",
    request: {
      params: OperationIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: TreasuryExecutionFeeBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Recorded treasury execution fee",
        content: {
          "application/json": {
            schema: TreasuryExecutionFeeSchema,
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
        description: "Operation not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const listCashMovementsRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/cash-movements",
    tags: ["Treasury"],
    summary: "List treasury cash movements by operation, deal, or route leg",
    request: {
      query: ListTreasuryCashMovementsQuerySchema,
    },
    responses: {
      200: {
        description: "Paginated treasury cash movements",
        content: {
          "application/json": {
            schema: TreasuryCashMovementListResponseSchema,
          },
        },
      },
    },
  });

  const createCashMovementRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/operations/{operationId}/cash-movements",
    tags: ["Treasury"],
    summary: "Record a treasury cash movement for an operation",
    request: {
      params: OperationIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: TreasuryCashMovementBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Recorded treasury cash movement",
        content: {
          "application/json": {
            schema: TreasuryCashMovementSchema,
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
        description: "Operation not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  return app
    .openapi(listFillsRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const fills = await ctx.treasuryModule.operations.queries.listExecutionFills({
          dealId: query.dealId,
          limit: query.limit,
          offset: query.offset,
          operationId: query.operationId,
          routeLegId: query.routeLegId,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
          sourceKind: query.sourceKind?.map((value) =>
            TreasuryOperationFactSourceKindSchema.parse(value),
          ),
        });

        return c.json(fills, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createFillRoute, async (c) => {
      try {
        const { operationId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.treasuryModule.operations.commands.recordExecutionFill({
            actualRateDen: parseMinorAmount(body.actualRateDen),
            actualRateNum: parseMinorAmount(body.actualRateNum),
            boughtAmountMinor: parseMinorAmount(body.boughtAmountMinor),
            boughtCurrencyId: body.boughtCurrencyId,
            calculationSnapshotId: body.calculationSnapshotId,
            confirmedAt: parseDateTime(body.confirmedAt),
            executedAt: parseDateTime(body.executedAt),
            externalRecordId: body.externalRecordId,
            fillSequence: body.fillSequence,
            instructionId: body.instructionId,
            metadata: body.metadata,
            notes: body.notes,
            operationId,
            providerCounterpartyId: body.providerCounterpartyId,
            providerRef: body.providerRef,
            routeLegId: body.routeLegId,
            routeVersionId: body.routeVersionId,
            soldAmountMinor: parseMinorAmount(body.soldAmountMinor),
            soldCurrencyId: body.soldCurrencyId,
            sourceKind: body.sourceKind,
            sourceRef: `treasury-execution-fill:${operationId}:${idempotencyKey}`,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listFeesRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const fees = await ctx.treasuryModule.operations.queries.listExecutionFees({
          dealId: query.dealId,
          limit: query.limit,
          offset: query.offset,
          operationId: query.operationId,
          routeLegId: query.routeLegId,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
          sourceKind: query.sourceKind?.map((value) =>
            TreasuryOperationFactSourceKindSchema.parse(value),
          ),
        });

        return c.json(fees, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createFeeRoute, async (c) => {
      try {
        const { operationId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.treasuryModule.operations.commands.recordExecutionFee({
            amountMinor: parseMinorAmount(body.amountMinor),
            calculationSnapshotId: body.calculationSnapshotId,
            chargedAt: parseDateTime(body.chargedAt),
            componentCode: body.componentCode,
            confirmedAt: parseDateTime(body.confirmedAt),
            currencyId: body.currencyId,
            externalRecordId: body.externalRecordId,
            feeFamily: body.feeFamily,
            fillId: body.fillId,
            instructionId: body.instructionId,
            metadata: body.metadata,
            notes: body.notes,
            operationId,
            providerCounterpartyId: body.providerCounterpartyId,
            providerRef: body.providerRef,
            routeComponentId: body.routeComponentId,
            routeLegId: body.routeLegId,
            routeVersionId: body.routeVersionId,
            sourceKind: body.sourceKind,
            sourceRef: `treasury-execution-fee:${operationId}:${idempotencyKey}`,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listCashMovementsRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const movements =
          await ctx.treasuryModule.operations.queries.listCashMovements({
            dealId: query.dealId,
            limit: query.limit,
            offset: query.offset,
            operationId: query.operationId,
            routeLegId: query.routeLegId,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
            sourceKind: query.sourceKind?.map((value) =>
              TreasuryOperationFactSourceKindSchema.parse(value),
            ),
          });

        return c.json(movements, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createCashMovementRoute, async (c) => {
      try {
        const { operationId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.treasuryModule.operations.commands.recordCashMovement({
            accountRef: body.accountRef,
            amountMinor: parseMinorAmount(body.amountMinor),
            bookedAt: parseDateTime(body.bookedAt),
            calculationSnapshotId: body.calculationSnapshotId,
            confirmedAt: parseDateTime(body.confirmedAt),
            currencyId: body.currencyId,
            direction: body.direction,
            externalRecordId: body.externalRecordId,
            instructionId: body.instructionId,
            metadata: body.metadata,
            notes: body.notes,
            operationId,
            providerCounterpartyId: body.providerCounterpartyId,
            providerRef: body.providerRef,
            requisiteId: body.requisiteId,
            routeLegId: body.routeLegId,
            routeVersionId: body.routeVersionId,
            sourceKind: body.sourceKind,
            sourceRef: `treasury-cash-movement:${operationId}:${idempotencyKey}`,
            statementRef: body.statementRef,
            valueDate: parseDateTime(body.valueDate),
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}

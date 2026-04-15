import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import {
  ListTreasuryOperationFactsQuerySchema,
  TreasuryOperationFactsListResponseSchema,
  TreasuryOperationFactSchema,
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

const TreasuryOperationFactBodySchema = z.object({
  amountMinor: MinorAmountStringSchema,
  confirmedAt: z.iso.datetime().nullable().optional().default(null),
  counterAmountMinor: MinorAmountStringSchema,
  counterCurrencyId: z.uuid().nullable().optional().default(null),
  currencyId: z.uuid().nullable().optional().default(null),
  externalRecordId: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .nullable()
    .optional()
    .default(null),
  feeAmountMinor: MinorAmountStringSchema,
  feeCurrencyId: z.uuid().nullable().optional().default(null),
  instructionId: z.uuid().nullable().optional().default(null),
  metadata: z.record(z.string(), z.unknown()).nullable().optional().default(null),
  notes: z.string().trim().max(1000).nullable().optional().default(null),
  providerRef: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .nullable()
    .optional()
    .default(null),
  recordedAt: z.iso.datetime().nullable().optional().default(null),
  routeLegId: z.uuid().nullable().optional().default(null),
  sourceKind: TreasuryOperationFactSourceKindSchema,
});

function parseMinorAmount(value: string | null) {
  return value === null ? null : BigInt(value);
}

export function treasuryOperationFactsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/operation-facts",
    tags: ["Treasury"],
    summary: "List treasury operation facts by operation, deal, or route leg",
    request: {
      query: ListTreasuryOperationFactsQuerySchema,
    },
    responses: {
      200: {
        description: "Paginated treasury operation facts",
        content: {
          "application/json": {
            schema: TreasuryOperationFactsListResponseSchema,
          },
        },
      },
    },
  });

  const createFactRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/operations/{operationId}/facts",
    tags: ["Treasury"],
    summary: "Record an actual treasury execution fact for an operation",
    request: {
      params: OperationIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: TreasuryOperationFactBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Recorded treasury operation fact",
        content: {
          "application/json": {
            schema: TreasuryOperationFactSchema,
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
    .openapi(listRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const facts = await ctx.treasuryModule.operations.queries.listFacts({
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

        return c.json(facts, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createFactRoute, async (c) => {
      try {
        const { operationId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.treasuryModule.operations.commands.recordActualFact({
            amountMinor: parseMinorAmount(body.amountMinor),
            confirmedAt: body.confirmedAt ? new Date(body.confirmedAt) : null,
            counterAmountMinor: parseMinorAmount(body.counterAmountMinor),
            counterCurrencyId: body.counterCurrencyId,
            currencyId: body.currencyId,
            externalRecordId: body.externalRecordId,
            feeAmountMinor: parseMinorAmount(body.feeAmountMinor),
            feeCurrencyId: body.feeCurrencyId,
            instructionId: body.instructionId,
            metadata: body.metadata,
            notes: body.notes,
            operationId,
            providerRef: body.providerRef,
            recordedAt: body.recordedAt ? new Date(body.recordedAt) : null,
            routeLegId: body.routeLegId,
            sourceKind: body.sourceKind,
            sourceRef: `treasury-operation-fact:${operationId}:${idempotencyKey}`,
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

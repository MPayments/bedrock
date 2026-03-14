import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import {
  CreateFxQuoteInputSchema,
  FxQuoteDetailsResponseSchema,
  FxQuoteListResponseSchema,
  FxQuoteSchema,
  ListFxQuotesQuerySchema,
  NotFoundError,
  ValidationError,
} from "@bedrock/fx";
import { minorToAmountString } from "@bedrock/shared/money";

import { ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const QuoteRefParamsSchema = z.object({
  quoteRef: z.string().min(1).max(255),
});

function serializeQuote(quote: Awaited<ReturnType<AppContext["fxService"]["quote"]>>) {
  return {
    id: quote.id,
    fromCurrencyId: quote.fromCurrencyId,
    toCurrencyId: quote.toCurrencyId,
    fromCurrency: quote.fromCurrency ?? "",
    toCurrency: quote.toCurrency ?? "",
    fromAmountMinor: quote.fromAmountMinor.toString(),
    toAmountMinor: quote.toAmountMinor.toString(),
    pricingMode: quote.pricingMode,
    pricingTrace: quote.pricingTrace ?? {},
    dealDirection: quote.dealDirection ?? null,
    dealForm: quote.dealForm ?? null,
    rateNum: quote.rateNum.toString(),
    rateDen: quote.rateDen.toString(),
    status: quote.status,
    usedByRef: quote.usedByRef ?? null,
    usedAt: quote.usedAt?.toISOString() ?? null,
    expiresAt: quote.expiresAt.toISOString(),
    idempotencyKey: quote.idempotencyKey,
    createdAt: quote.createdAt.toISOString(),
  };
}

function serializeQuoteListItem(
  quote: Awaited<ReturnType<AppContext["fxService"]["quote"]>>,
) {
  return {
    ...serializeQuote(quote),
    fromAmount: minorToAmountString(quote.fromAmountMinor, {
      currency: quote.fromCurrency ?? "",
    }),
    toAmount: minorToAmountString(quote.toAmountMinor, {
      currency: quote.toCurrency ?? "",
    }),
  };
}

function serializeQuoteDetails(
  details: Awaited<ReturnType<AppContext["fxService"]["getQuoteDetails"]>>,
) {
  return {
    quote: serializeQuote(details.quote),
    legs: details.legs.map((leg) => ({
      id: leg.id,
      quoteId: leg.quoteId,
      idx: leg.idx,
      fromCurrencyId: leg.fromCurrencyId,
      toCurrencyId: leg.toCurrencyId,
      fromCurrency: leg.fromCurrency ?? "",
      toCurrency: leg.toCurrency ?? "",
      fromAmountMinor: leg.fromAmountMinor.toString(),
      toAmountMinor: leg.toAmountMinor.toString(),
      rateNum: leg.rateNum.toString(),
      rateDen: leg.rateDen.toString(),
      sourceKind: leg.sourceKind,
      sourceRef: leg.sourceRef ?? null,
      asOf: leg.asOf.toISOString(),
      executionCounterpartyId: leg.executionCounterpartyId ?? null,
      createdAt: leg.createdAt.toISOString(),
    })),
    feeComponents: details.feeComponents.map((component) => ({
      ...component,
      amountMinor: component.amountMinor.toString(),
    })),
    financialLines: details.financialLines.map((line) => ({
      ...line,
      amountMinor: line.amountMinor.toString(),
    })),
    pricingTrace: details.pricingTrace,
  };
}

function toQuoteInput(body: z.infer<typeof CreateFxQuoteInputSchema>) {
  if (body.mode === "auto_cross") {
    return {
      ...body,
      fromAmountMinor: BigInt(body.fromAmountMinor),
      asOf: new Date(body.asOf),
      manualFinancialLines: body.manualFinancialLines?.map((line) => ({
        ...line,
        amountMinor: BigInt(line.amountMinor),
      })),
    };
  }

  return {
    ...body,
    fromAmountMinor: BigInt(body.fromAmountMinor),
    asOf: new Date(body.asOf),
    manualFinancialLines: body.manualFinancialLines?.map((line) => ({
      ...line,
      amountMinor: BigInt(line.amountMinor),
    })),
    legs: body.legs.map((leg) => ({
      ...leg,
      rateNum: BigInt(leg.rateNum),
      rateDen: BigInt(leg.rateDen),
      asOf: leg.asOf ? new Date(leg.asOf) : undefined,
    })),
  };
}

export function fxQuotesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const createQuoteRoute = createRoute({
    middleware: [requirePermission({ documents: ["create"] })],
    method: "post",
    path: "/",
    tags: ["FX"],
    summary: "Create FX quote",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: CreateFxQuoteInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "FX quote created",
        content: {
          "application/json": {
            schema: FxQuoteSchema,
          },
        },
      },
      400: {
        description: "Validation error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const listQuotesRoute = createRoute({
    middleware: [requirePermission({ documents: ["list"] })],
    method: "get",
    path: "/",
    tags: ["FX"],
    summary: "List FX quotes",
    request: {
      query: ListFxQuotesQuerySchema,
    },
    responses: {
      200: {
        description: "Paginated FX quotes",
        content: {
          "application/json": {
            schema: FxQuoteListResponseSchema,
          },
        },
      },
    },
  });

  const getQuoteRoute = createRoute({
    middleware: [requirePermission({ documents: ["get"] })],
    method: "get",
    path: "/{quoteRef}",
    tags: ["FX"],
    summary: "Get FX quote details",
    request: {
      params: QuoteRefParamsSchema,
    },
    responses: {
      200: {
        description: "FX quote details",
        content: {
          "application/json": {
            schema: FxQuoteDetailsResponseSchema,
          },
        },
      },
      400: {
        description: "Validation error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Quote not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  return app
    .openapi(listQuotesRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.fxService.listQuotes(query);

      return c.json(
        {
          data: result.data.map((quote) => serializeQuoteListItem(quote)),
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
        200,
      );
    })
    .openapi(createQuoteRoute, async (c) => {
      try {
        const body = c.req.valid("json");
        const quote = await ctx.fxService.quote(toQuoteInput(body));
        return c.json(serializeQuote(quote), 201);
      } catch (error) {
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(getQuoteRoute, async (c) => {
      try {
        const { quoteRef } = c.req.valid("param");
        const details = await ctx.fxService.getQuoteDetails({ quoteRef });
        return c.json(serializeQuoteDetails(details), 200);
      } catch (error) {
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        if (error instanceof NotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    });
}

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { minorToAmountString } from "@bedrock/shared/money";
import {
  NotFoundError,
  QuoteIdempotencyConflictError,
  ValidationError,
} from "@bedrock/treasury";
import {
  CreateQuoteInputSchema,
  ListQuotesQuerySchema,
  PreviewQuoteInputSchema,
  type Quote,
  type QuoteDetailsRecord,
  type QuoteDetailsResponse,
  type QuoteListItem,
  type QuotePreviewRecord,
  type QuotePreviewResponse,
  type QuoteRecord,
  QuoteDetailsResponseSchema,
  QuoteListResponseSchema,
  QuotePreviewResponseSchema,
  QuoteSchema,
} from "@bedrock/treasury/contracts";

import { ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const QuoteRefParamsSchema = z.object({
  quoteRef: z.string().min(1).max(255),
});

function serializeQuote(quote: QuoteRecord): Quote {
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

function serializeQuoteListItem(quote: QuoteRecord): QuoteListItem {
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
  details: QuoteDetailsRecord,
): QuoteDetailsResponse {
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

function serializeQuotePreview(
  preview: QuotePreviewRecord,
): QuotePreviewResponse {
  return {
    fromCurrency: preview.fromCurrency,
    toCurrency: preview.toCurrency,
    fromAmountMinor: preview.fromAmountMinor.toString(),
    toAmountMinor: preview.toAmountMinor.toString(),
    fromAmount: minorToAmountString(preview.fromAmountMinor, {
      currency: preview.fromCurrency,
    }),
    toAmount: minorToAmountString(preview.toAmountMinor, {
      currency: preview.toCurrency,
    }),
    pricingMode: preview.pricingMode,
    pricingTrace: preview.pricingTrace,
    dealDirection: preview.dealDirection,
    dealForm: preview.dealForm,
    rateNum: preview.rateNum.toString(),
    rateDen: preview.rateDen.toString(),
    expiresAt: preview.expiresAt.toISOString(),
    legs: preview.legs.map((leg) => ({
      idx: leg.idx,
      fromCurrency: leg.fromCurrency,
      toCurrency: leg.toCurrency,
      fromAmountMinor: leg.fromAmountMinor.toString(),
      toAmountMinor: leg.toAmountMinor.toString(),
      rateNum: leg.rateNum.toString(),
      rateDen: leg.rateDen.toString(),
      sourceKind: leg.sourceKind,
      sourceRef: leg.sourceRef ?? null,
      asOf: leg.asOf.toISOString(),
      executionCounterpartyId: leg.executionCounterpartyId ?? null,
    })),
    feeComponents: preview.feeComponents.map((component) => ({
      ...component,
      amountMinor: component.amountMinor.toString(),
    })),
    financialLines: preview.financialLines.map((line) => ({
      ...line,
      amountMinor: line.amountMinor.toString(),
    })),
  };
}

export function treasuryQuotesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const createQuoteRoute = createRoute({
    middleware: [requirePermission({ documents: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Treasury"],
    summary: "Create treasury quote",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: CreateQuoteInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Treasury quote created",
        content: {
          "application/json": {
            schema: QuoteSchema,
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

  const listQuotesRoute = createRoute({
    middleware: [requirePermission({ documents: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Treasury"],
    summary: "List treasury quotes",
    request: {
      query: ListQuotesQuerySchema,
    },
    responses: {
      200: {
        description: "Paginated treasury quotes",
        content: {
          "application/json": {
            schema: QuoteListResponseSchema,
          },
        },
      },
    },
  });

  const previewQuoteRoute = createRoute({
    middleware: [requirePermission({ documents: ["create"] })],
    method: "post",
    path: "/preview",
    tags: ["Treasury"],
    summary: "Preview treasury quote",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: PreviewQuoteInputSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Treasury quote preview",
        content: {
          "application/json": {
            schema: QuotePreviewResponseSchema,
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

  const getQuoteRoute = createRoute({
    middleware: [requirePermission({ documents: ["get"] })],
    method: "get",
    path: "/{quoteRef}",
    tags: ["Treasury"],
    summary: "Get treasury quote details",
    request: {
      params: QuoteRefParamsSchema,
    },
    responses: {
      200: {
        description: "Treasury quote details",
        content: {
          "application/json": {
            schema: QuoteDetailsResponseSchema,
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
      const result =
        await ctx.treasuryModule.pricing.quotes.queries.listQuotes(query);

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
        const quote =
          await ctx.treasuryModule.pricing.quotes.commands.createQuote(body);
        return c.json(serializeQuote(quote), 201);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return c.json(
            { error: "Validation error", details: z.treeifyError(error) },
            400,
          );
        }
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        if (error instanceof QuoteIdempotencyConflictError) {
          return c.json({ error: error.message }, 409);
        }
        throw error;
      }
    })
    .openapi(previewQuoteRoute, async (c) => {
      try {
        const body = c.req.valid("json");
        const preview =
          await ctx.treasuryModule.pricing.quotes.queries.previewQuote(body);
        return c.json(serializeQuotePreview(preview), 200);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return c.json(
            { error: "Validation error", details: z.treeifyError(error) },
            400,
          );
        }
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(getQuoteRoute, async (c) => {
      try {
        const { quoteRef } = c.req.valid("param");
        const details =
          await ctx.treasuryModule.pricing.quotes.queries.getQuoteDetails({
            quoteRef,
          });
        return c.json(serializeQuoteDetails(details), 200);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return c.json(
            { error: "Validation error", details: z.treeifyError(error) },
            400,
          );
        }
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

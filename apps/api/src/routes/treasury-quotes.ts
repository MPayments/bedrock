import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import {
  NotFoundError,
  QuoteIdempotencyConflictError,
  ValidationError,
} from "@bedrock/treasury";
import {
  CreateQuoteInputSchema,
  ListQuotesQuerySchema,
  PreviewQuoteInputSchema,
  QuoteDetailsResponseSchema,
  QuoteListResponseSchema,
  QuotePreviewResponseSchema,
  QuoteSchema,
} from "@bedrock/treasury/contracts";

import { ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  serializeQuote,
  serializeQuoteDetails,
  serializeQuoteListItem,
  serializeQuotePreview,
} from "./internal/treasury-quote-dto";

const QuoteRefParamsSchema = z.object({
  quoteRef: z.string().min(1).max(255),
});

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
      const result = await ctx.treasuryModule.quotes.queries.listQuotes(query);

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
        const quote = await ctx.treasuryModule.quotes.commands.createQuote(body);
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
        const preview = await ctx.treasuryModule.quotes.queries.previewQuote(body);
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
          await ctx.treasuryModule.quotes.queries.getQuoteDetails({
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

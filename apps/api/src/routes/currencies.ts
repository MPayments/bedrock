import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
    CurrencySchema,
    CreateCurrencyInputSchema,
    UpdateCurrencyInputSchema,
    CurrencyNotFoundError,
} from "@bedrock/currencies";
import { createPaginatedListSchema, PaginationInputSchema } from "@bedrock/kernel/pagination";

import type { AppContext } from "../context";
import { ErrorSchema, IdParamSchema } from "../common";
import { requirePermission } from "../middleware/permission";
import type { AuthVariables } from "../middleware/auth";

const PaginatedCurrenciesSchema = createPaginatedListSchema(CurrencySchema);

export function currenciesRoutes(ctx: AppContext) {
    const app = new OpenAPIHono<{ Variables: AuthVariables }>();

    const listRoute = createRoute({
        middleware: [requirePermission({ currencies: ["list"] })],
        method: "get",
        path: "/",
        tags: ["Currencies"],
        summary: "List currencies",
        request: {
            query: PaginationInputSchema,
        },
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: PaginatedCurrenciesSchema,
                    },
                },
                description: "Paginated list of currencies",
            },
        },
    });

    const createRoute_ = createRoute({
        middleware: [requirePermission({ currencies: ["create"] })],
        method: "post",
        path: "/",
        tags: ["Currencies"],
        summary: "Create a new currency",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: CreateCurrencyInputSchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            201: {
                content: {
                    "application/json": {
                        schema: CurrencySchema,
                    },
                },
                description: "Currency created",
            },
            400: {
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
                description: "Validation error",
            },
        },
    });

    const getRoute = createRoute({
        middleware: [requirePermission({ currencies: ["read"] })],
        method: "get",
        path: "/{id}",
        tags: ["Currencies"],
        summary: "Get a currency by ID",
        request: {
            params: IdParamSchema,
        },
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: CurrencySchema,
                    },
                },
                description: "Currency found",
            },
            404: {
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
                description: "Currency not found",
            },
        },
    });

    const updateRoute = createRoute({
        middleware: [requirePermission({ currencies: ["update"] })],
        method: "patch",
        path: "/{id}",
        tags: ["Currencies"],
        summary: "Update a currency",
        request: {
            params: IdParamSchema,
            body: {
                content: {
                    "application/json": {
                        schema: UpdateCurrencyInputSchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: CurrencySchema,
                    },
                },
                description: "Currency updated",
            },
            404: {
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
                description: "Currency not found",
            },
        },
    });

    return app
        .openapi(listRoute, async (c) => {
            const { limit, offset } = c.req.valid("query");
            const result = await ctx.currenciesService.list({ limit, offset });
            return c.json(result, 200);
        })
        .openapi(createRoute_, async (c) => {
            const input = c.req.valid("json");
            const currency = await ctx.currenciesService.create(input);
            return c.json(currency, 201);
        })
        .openapi(getRoute, async (c) => {
            const { id } = c.req.valid("param");
            try {
                const currency = await ctx.currenciesService.findById(id);
                return c.json(currency, 200);
            } catch (err) {
                if (err instanceof CurrencyNotFoundError) {
                    return c.json({ error: err.message }, 404);
                }
                throw err;
            }
        })
        .openapi(updateRoute, async (c) => {
            const { id } = c.req.valid("param");
            const input = c.req.valid("json");
            try {
                const currency = await ctx.currenciesService.update(id, input);
                return c.json(currency, 200);
            } catch (err) {
                if (err instanceof CurrencyNotFoundError) {
                    return c.json({ error: err.message }, 404);
                }
                throw err;
            }
        });
}
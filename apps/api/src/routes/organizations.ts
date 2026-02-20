import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import { createPaginatedListSchema } from "@bedrock/kernel/pagination";
import {
    OrganizationSchema,
    ListOrganizationsQuerySchema,
    CreateOrganizationInputSchema,
    UpdateOrganizationInputSchema,
    OrganizationNotFoundError,
} from "@bedrock/organizations";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const PaginatedOrganizationsSchema = createPaginatedListSchema(OrganizationSchema);

export function organizationsRoutes(ctx: AppContext) {
    const app = new OpenAPIHono<{ Variables: AuthVariables }>();

    const listRoute = createRoute({
        // middleware: [requirePermission({ organizations: ["list"] })],
        method: "get",
        path: "/",
        tags: ["Organizations"],
        summary: "List organizations",
        request: {
            query: ListOrganizationsQuerySchema,
        },
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: PaginatedOrganizationsSchema,
                    },
                },
                description: "Paginated list of organizations",
            },
        },
    });

    const createRoute_ = createRoute({
        middleware: [requirePermission({ organizations: ["create"] })],
        method: "post",
        path: "/",
        tags: ["Organizations"],
        summary: "Create a new organization",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: CreateOrganizationInputSchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            201: {
                content: {
                    "application/json": {
                        schema: OrganizationSchema,
                    },
                },
                description: "Organization created",
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
        middleware: [requirePermission({ organizations: ["list"] })],
        method: "get",
        path: "/{id}",
        tags: ["Organizations"],
        summary: "Get an organization by ID",
        request: {
            params: IdParamSchema,
        },
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: OrganizationSchema,
                    },
                },
                description: "Organization found",
            },
            404: {
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
                description: "Organization not found",
            },
        },
    });

    const updateRoute = createRoute({
        middleware: [requirePermission({ organizations: ["update"] })],
        method: "patch",
        path: "/{id}",
        tags: ["Organizations"],
        summary: "Update an organization",
        request: {
            params: IdParamSchema,
            body: {
                content: {
                    "application/json": {
                        schema: UpdateOrganizationInputSchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: OrganizationSchema,
                    },
                },
                description: "Organization updated",
            },
            404: {
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
                description: "Organization not found",
            },
        },
    });

    const deleteRoute = createRoute({
        middleware: [requirePermission({ organizations: ["delete"] })],
        method: "delete",
        path: "/{id}",
        tags: ["Organizations"],
        summary: "Delete an organization",
        request: {
            params: IdParamSchema,
        },
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: DeletedSchema,
                    },
                },
                description: "Organization deleted",
            },
            404: {
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
                description: "Organization not found",
            },
        },
    });

    return app
        .openapi(listRoute, async (c) => {
            const query = c.req.valid("query");
            const result = await ctx.organizationsService.list(query);
            return c.json(result, 200);
        })
        .openapi(createRoute_, async (c) => {
            const input = c.req.valid("json");
            const org = await ctx.organizationsService.create(input);
            return c.json(org, 201);
        })
        .openapi(getRoute, async (c) => {
            const { id } = c.req.valid("param");
            try {
                const org = await ctx.organizationsService.findById(id);
                return c.json(org, 200);
            } catch (err) {
                if (err instanceof OrganizationNotFoundError) {
                    return c.json({ error: err.message }, 404);
                }
                throw err;
            }
        })
        .openapi(updateRoute, async (c) => {
            const { id } = c.req.valid("param");
            const input = c.req.valid("json");
            try {
                const org = await ctx.organizationsService.update(id, input);
                return c.json(org, 200);
            } catch (err) {
                if (err instanceof OrganizationNotFoundError) {
                    return c.json({ error: err.message }, 404);
                }
                throw err;
            }
        })
        .openapi(deleteRoute, async (c) => {
            const { id } = c.req.valid("param");
            try {
                await ctx.organizationsService.remove(id);
                return c.json({ deleted: true }, 200);
            } catch (err) {
                if (err instanceof OrganizationNotFoundError) {
                    return c.json({ error: err.message }, 404);
                }
                throw err;
            }
        });
}

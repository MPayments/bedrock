import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
    OrganizationSchema,
    CreateOrganizationInputSchema,
    UpdateOrganizationInputSchema,
    OrganizationIdParamSchema,
    OrganizationNotFoundError,
} from "@bedrock/organizations";
import type { AppContext } from "../context";
import { ErrorSchema, DeletedSchema } from "../common";

export function organizationsRoutes(ctx: AppContext) {
    const app = new OpenAPIHono();

    const listRoute = createRoute({
        method: "get",
        path: "/",
        tags: ["Organizations"],
        summary: "List all organizations",
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: z.array(OrganizationSchema),
                    },
                },
                description: "List of organizations",
            },
        },
    });

    const createRoute_ = createRoute({
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
        method: "get",
        path: "/{id}",
        tags: ["Organizations"],
        summary: "Get an organization by ID",
        request: {
            params: OrganizationIdParamSchema,
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
        method: "patch",
        path: "/{id}",
        tags: ["Organizations"],
        summary: "Update an organization",
        request: {
            params: OrganizationIdParamSchema,
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
        method: "delete",
        path: "/{id}",
        tags: ["Organizations"],
        summary: "Delete an organization",
        request: {
            params: OrganizationIdParamSchema,
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
            const orgs = await ctx.organizations.list();
            return c.json(orgs, 200);
        })
        .openapi(createRoute_, async (c) => {
            const input = c.req.valid("json");
            const org = await ctx.organizations.create(input);
            return c.json(org, 201);
        })
        .openapi(getRoute, async (c) => {
            const { id } = c.req.valid("param");
            const org = await ctx.organizations.findById(id);
            if (!org) {
                return c.json({ error: "Organization not found" }, 404);
            }
            return c.json(org, 200);
        })
        .openapi(updateRoute, async (c) => {
            const { id } = c.req.valid("param");
            const input = c.req.valid("json");
            try {
                const org = await ctx.organizations.update(id, input);
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
                await ctx.organizations.delete(id);
                return c.json({ deleted: true }, 200);
            } catch (err) {
                if (err instanceof OrganizationNotFoundError) {
                    return c.json({ error: err.message }, 404);
                }
                throw err;
            }
        });
}

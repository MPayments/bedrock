import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
    InvalidPasswordError,
    UserNotFoundError,
    UserEmailConflictError,
    UpdateProfileInputSchema,
    ChangeOwnPasswordInputSchema,
} from "@bedrock/users";

import { ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import {
    SerializedUserSchema,
    SerializedUserWithLastSessionSchema,
    serializeUser,
    serializeUserWithSession,
} from "./users-serialization";

export function profileRoutes(ctx: AppContext) {
    const app = new OpenAPIHono<{ Variables: AuthVariables }>();

    const getProfileRoute = createRoute({
        method: "get",
        path: "/",
        tags: ["Profile"],
        summary: "Get current user profile",
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: SerializedUserWithLastSessionSchema,
                    },
                },
                description: "Current user profile",
            },
            404: {
                content: {
                    "application/json": { schema: ErrorSchema },
                },
                description: "User not found",
            },
        },
    });

    const updateProfileRoute = createRoute({
        method: "patch",
        path: "/",
        tags: ["Profile"],
        summary: "Update current user profile",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: UpdateProfileInputSchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: SerializedUserSchema,
                    },
                },
                description: "Profile updated",
            },
            404: {
                content: {
                    "application/json": { schema: ErrorSchema },
                },
                description: "User not found",
            },
            409: {
                content: {
                    "application/json": { schema: ErrorSchema },
                },
                description: "Email already exists",
            },
        },
    });

    const changePasswordRoute = createRoute({
        method: "post",
        path: "/change-password",
        tags: ["Profile"],
        summary: "Change own password",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: ChangeOwnPasswordInputSchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: z.object({ success: z.boolean() }),
                    },
                },
                description: "Password changed",
            },
            400: {
                content: {
                    "application/json": { schema: ErrorSchema },
                },
                description: "Invalid current password",
            },
            404: {
                content: {
                    "application/json": { schema: ErrorSchema },
                },
                description: "User not found",
            },
        },
    });

    return app
        .openapi(getProfileRoute, async (c) => {
            const userId = c.get("user")!.id;
            try {
                const user = await ctx.usersService.findById(userId);
                return c.json(serializeUserWithSession(user), 200);
            } catch (err) {
                if (err instanceof UserNotFoundError) {
                    return c.json({ error: err.message }, 404);
                }
                throw err;
            }
        })
        .openapi(updateProfileRoute, async (c) => {
            const userId = c.get("user")!.id;
            const input = c.req.valid("json");
            try {
                const user = await ctx.usersService.update(userId, input);
                return c.json(serializeUser(user), 200);
            } catch (err) {
                if (err instanceof UserNotFoundError) {
                    return c.json({ error: err.message }, 404);
                }
                if (err instanceof UserEmailConflictError) {
                    return c.json({ error: err.message }, 409);
                }
                throw err;
            }
        })
        .openapi(changePasswordRoute, async (c) => {
            const userId = c.get("user")!.id;
            const input = c.req.valid("json");
            try {
                await ctx.usersService.changeOwnPassword(userId, input);
                return c.json({ success: true }, 200);
            } catch (err) {
                if (err instanceof InvalidPasswordError) {
                    return c.json({ error: err.message }, 400);
                }
                if (err instanceof UserNotFoundError) {
                    return c.json({ error: err.message }, 404);
                }
                throw err;
            }
        });
}

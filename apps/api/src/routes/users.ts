import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  BanUserInputSchema,
  ChangePasswordInputSchema,
  CreateUserInputSchema,
  ListUsersQuerySchema,
  UserEmailConflictError,
  UserNotFoundError,
  UpdateUserInputSchema,
} from "@bedrock/core/users";
import { createPaginatedListSchema } from "@bedrock/kernel/pagination";

import { ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  SerializedUserSchema,
  SerializedUserWithLastSessionSchema,
  serializeUser,
  serializeUserWithSession,
} from "./users-serialization";

const PaginatedUsersSchema = createPaginatedListSchema(SerializedUserSchema);

const UserIdParamSchema = z.object({
  id: z.string().openapi({
    param: {
      name: "id",
      in: "path",
      example: "00000000-0000-4000-8000-000000000901",
    },
  }),
});

export function usersRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ users: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Users"],
    summary: "List users",
    request: {
      query: ListUsersQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedUsersSchema,
          },
        },
        description: "Paginated list of users",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ users: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Users"],
    summary: "Get a user by ID",
    request: {
      params: UserIdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: SerializedUserWithLastSessionSchema,
          },
        },
        description: "User found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "User not found",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ users: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Users"],
    summary: "Create a new user",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateUserInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: SerializedUserSchema,
          },
        },
        description: "User created",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Email already exists",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ users: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Users"],
    summary: "Update a user",
    request: {
      params: UserIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateUserInputSchema,
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
        description: "User updated",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "User not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Email already exists",
      },
    },
  });

  const changePasswordRoute = createRoute({
    middleware: [requirePermission({ users: ["update"] })],
    method: "post",
    path: "/{id}/change-password",
    tags: ["Users"],
    summary: "Change user password",
    request: {
      params: UserIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: ChangePasswordInputSchema,
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
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "User not found",
      },
    },
  });

  const banRoute = createRoute({
    middleware: [requirePermission({ users: ["update"] })],
    method: "post",
    path: "/{id}/ban",
    tags: ["Users"],
    summary: "Ban a user",
    request: {
      params: UserIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: BanUserInputSchema,
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
        description: "User banned",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "User not found",
      },
    },
  });

  const unbanRoute = createRoute({
    middleware: [requirePermission({ users: ["update"] })],
    method: "post",
    path: "/{id}/unban",
    tags: ["Users"],
    summary: "Unban a user",
    request: {
      params: UserIdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: SerializedUserSchema,
          },
        },
        description: "User unbanned",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "User not found",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.usersService.list(query);

      return c.json(
        { ...result, data: result.data.map(serializeUser) },
        200,
      );
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const user = await ctx.usersService.findById(id);
        return c.json(serializeUserWithSession(user), 200);
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");

      try {
        const user = await ctx.usersService.create(input);
        return c.json(serializeUser(user), 201);
      } catch (error) {
        if (error instanceof UserEmailConflictError) {
          return c.json({ error: error.message }, 409);
        }

        throw error;
      }
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const user = await ctx.usersService.update(id, input);
        return c.json(serializeUser(user), 200);
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        if (error instanceof UserEmailConflictError) {
          return c.json({ error: error.message }, 409);
        }

        throw error;
      }
    })
    .openapi(changePasswordRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        await ctx.usersService.changePassword(id, input);
        return c.json({ success: true }, 200);
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    })
    .openapi(banRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const user = await ctx.usersService.ban(id, input);
        return c.json(serializeUser(user), 200);
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    })
    .openapi(unbanRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const user = await ctx.usersService.unban(id);
        return c.json(serializeUser(user), 200);
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    });
}

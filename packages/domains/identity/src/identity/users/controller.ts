import { defineController, http, type DefinedController } from "@bedrock/core";
import {
  ConflictHttpError,
  IdParamSchema,
  NotFoundHttpError,
} from "@multihansa/common/bedrock";
import { createPaginatedListSchema } from "@multihansa/common/pagination";
import {
  AuthContextToken,
  requirePermissionMiddleware,
} from "@bedrock/security";
import { z } from "zod";

import {
  BanUserInputSchema,
  ChangePasswordInputSchema,
  CreateUserInputSchema,
  ListUsersQuerySchema,
  UpdateUserInputSchema,
} from "./validation";

import {
  serializeUser,
  serializeUserWithSession,
  SerializedUserSchema,
  SerializedUserWithLastSessionSchema,
} from "./serialization";
import { usersService } from "./service";

const PaginatedUsersSchema = createPaginatedListSchema(SerializedUserSchema);
const SuccessSchema = z.object({
  success: z.literal(true),
});

export const usersController: DefinedController = defineController("users-http", {
  basePath: "/v1/users",
  deps: {
    auth: AuthContextToken,
  },
  ctx: ({ auth }, { call }) => ({
    auth,
    call,
  }),
  routes: ({ route }) => ({
    list: route.get({
      path: "/",
      request: {
        query: ListUsersQuerySchema,
      },
      responses: {
        200: PaginatedUsersSchema,
      },
      middleware: [requirePermissionMiddleware("users:list")],
      handler: async ({ ctx, request }) => {
        const result = await ctx.call(usersService.actions.list, request.query);

        return {
          ...result,
          data: result.data.map((item) => serializeUser(item)),
        };
      },
    }),
    get: route.get({
      path: "/:id",
      request: {
        params: IdParamSchema,
      },
      responses: {
        200: SerializedUserWithLastSessionSchema,
      },
      middleware: [requirePermissionMiddleware("users:list")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ call, request }) =>
        serializeUserWithSession(
          await call(usersService.actions.get, request.params),
        ),
    }),
    create: route.post({
      path: "/",
      request: {
        body: CreateUserInputSchema,
      },
      responses: {
        201: SerializedUserSchema,
      },
      middleware: [requirePermissionMiddleware("users:create")],
      errors: {
        MULTIHANSA_CONFLICT: ConflictHttpError,
      },
      handler: async ({ call, request }) =>
        http.reply.created(
          serializeUser(await call(usersService.actions.create, request.body)),
        ),
    }),
    update: route.patch({
      path: "/:id",
      request: {
        params: IdParamSchema,
        body: UpdateUserInputSchema,
      },
      responses: {
        200: SerializedUserSchema,
      },
      middleware: [requirePermissionMiddleware("users:update")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
      },
      handler: async ({ call, request }) =>
        serializeUser(
          await call(usersService.actions.update, {
            id: request.params.id,
            input: request.body,
          }),
        ),
    }),
    changePassword: route.post({
      path: "/:id/change-password",
      request: {
        params: IdParamSchema,
        body: ChangePasswordInputSchema,
      },
      responses: {
        200: SuccessSchema,
      },
      middleware: [requirePermissionMiddleware("users:update")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ call, request }) => {
        await call(usersService.actions.changePassword, {
          id: request.params.id,
          input: request.body,
        });
        return {
          success: true as const,
        };
      },
    }),
    ban: route.post({
      path: "/:id/ban",
      request: {
        params: IdParamSchema,
        body: BanUserInputSchema,
      },
      responses: {
        200: SerializedUserSchema,
      },
      middleware: [requirePermissionMiddleware("users:update")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ call, request }) =>
        serializeUser(
          await call(usersService.actions.ban, {
            id: request.params.id,
            input: request.body,
          }),
        ),
    }),
    unban: route.post({
      path: "/:id/unban",
      request: {
        params: IdParamSchema,
      },
      responses: {
        200: SerializedUserSchema,
      },
      middleware: [requirePermissionMiddleware("users:update")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ call, request }) =>
        serializeUser(await call(usersService.actions.unban, request.params)),
    }),
  }),
});

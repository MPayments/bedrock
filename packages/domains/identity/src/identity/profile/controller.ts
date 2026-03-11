import { z } from "zod";

import { defineController, type DefinedController } from "@bedrock/core";
import {
  BadRequestHttpError,
  ConflictHttpError,
  NotFoundHttpError,
  requireActorUserId,
} from "@multihansa/common/bedrock";
import { AuthContextToken, requireActorMiddleware } from "@bedrock/security";

import {
  ChangeOwnPasswordInputSchema,
  UpdateProfileInputSchema,
} from "../users/validation";

import { profileService } from "./service";
import { SerializedUserSchema, SerializedUserWithLastSessionSchema, serializeUser, serializeUserWithSession } from "../users/serialization";

const SuccessSchema = z.object({
  success: z.literal(true),
});

export const profileController: DefinedController = defineController("profile-http", {
  basePath: "/v1/me",
  deps: {
    auth: AuthContextToken,
  },
  routes: ({ route }) => ({
    get: route.get({
      path: "/",
      responses: {
        200: SerializedUserWithLastSessionSchema,
      },
      middleware: [requireActorMiddleware()],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ ctx, call }) =>
        serializeUserWithSession(
          await call(profileService.actions.get, {
            userId: requireActorUserId(ctx.auth),
          }),
        ),
    }),
    update: route.patch({
      path: "/",
      request: {
        body: UpdateProfileInputSchema,
      },
      responses: {
        200: SerializedUserSchema,
      },
      middleware: [requireActorMiddleware()],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
      },
      handler: async ({ ctx, call, request }) =>
        serializeUser(
          await call(profileService.actions.update, {
            userId: requireActorUserId(ctx.auth),
            input: request.body,
          }),
        ),
    }),
    changePassword: route.post({
      path: "/change-password",
      request: {
        body: ChangeOwnPasswordInputSchema,
      },
      responses: {
        200: SuccessSchema,
      },
      middleware: [requireActorMiddleware()],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ ctx, call, request }) => {
        await call(profileService.actions.changePassword, {
          userId: requireActorUserId(ctx.auth),
          input: request.body,
        });
        return {
          success: true as const,
        };
      },
    }),
  }),
});

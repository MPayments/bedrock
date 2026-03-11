import { z } from "zod";

import { defineService, error, type Logger as BedrockLogger } from "@bedrock/core";

import {
  ChangeOwnPasswordInputSchema,
  UpdateProfileInputSchema,
  UserSchema,
} from "../users/validation";
import {
  InvalidPasswordError,
  UserEmailConflictError,
  UserNotFoundError,
} from "../users/errors";

import {
  BadRequestDomainError,
  ConflictDomainError,
  DbToken,
  NotFoundDomainError,
  adaptBedrockLogger,
} from "@multihansa/common/bedrock";
import { createUsersService as createUsersRuntime } from "../users/runtime";

const ProfileInputSchema = z.object({
  userId: z.uuid(),
});

const UpdateProfileActionInputSchema = z.object({
  userId: z.uuid(),
  input: UpdateProfileInputSchema,
});

const ChangeOwnPasswordActionInputSchema = z.object({
  userId: z.uuid(),
  input: ChangeOwnPasswordInputSchema,
});

const UserWithLastSessionSchema = UserSchema.extend({
  lastSessionAt: z.date().nullable(),
  lastSessionIp: z.string().nullable(),
});

function getUsersRuntime(ctx: {
  db: Parameters<typeof createUsersRuntime>[0]["db"];
  logger: BedrockLogger;
}) {
  return createUsersRuntime({
    db: ctx.db,
    logger: adaptBedrockLogger(ctx.logger),
  });
}

export const profileService = defineService("profile", {
  deps: {
    db: DbToken,
  },
  ctx: ({ db }) => ({
    db,
  }),
  actions: ({ action }) => ({
    get: action({
      input: ProfileInputSchema,
      output: UserWithLastSessionSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await getUsersRuntime(ctx).findById(input.userId);
        } catch (cause) {
          if (cause instanceof UserNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    update: action({
      input: UpdateProfileActionInputSchema,
      output: UserSchema,
      errors: [NotFoundDomainError, ConflictDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await getUsersRuntime(ctx).update(input.userId, input.input);
        } catch (cause) {
          if (cause instanceof UserNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }

          if (cause instanceof UserEmailConflictError) {
            return error(ConflictDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    changePassword: action({
      input: ChangeOwnPasswordActionInputSchema,
      errors: [BadRequestDomainError, NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          await getUsersRuntime(ctx).changeOwnPassword(
            input.userId,
            input.input,
          );
          return undefined;
        } catch (cause) {
          if (cause instanceof InvalidPasswordError) {
            return error(BadRequestDomainError, { message: cause.message });
          }

          if (cause instanceof UserNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
  }),
});

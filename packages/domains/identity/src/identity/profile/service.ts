
import { defineService, error, type Logger as BedrockLogger } from "@bedrock/core";
import { z } from "zod";


import {
  BadRequestDomainError,
  ConflictDomainError,
  DbToken,
  NotFoundDomainError,
  adaptBedrockLogger,
} from "@multihansa/common/bedrock";

import { createChangeOwnPasswordHandler } from "../users/commands/change-own-password";
import { createGetUserHandler } from "../users/commands/get-user";
import { createUpdateUserHandler } from "../users/commands/update-user";
import {
  InvalidPasswordError,
  UserEmailConflictError,
  UserNotFoundError,
} from "../users/errors";
import { createUsersServiceContext } from "../users/internal/context";
import {
  ChangeOwnPasswordInputSchema,
  UpdateProfileInputSchema,
  UserSchema,
} from "../users/validation";

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

function createUsersContext(ctx: {
  db: Parameters<typeof createUsersServiceContext>[0]["db"];
  logger: BedrockLogger;
}) {
  return createUsersServiceContext({
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
          return await createGetUserHandler(createUsersContext(ctx))(input.userId);
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
          return await createUpdateUserHandler(createUsersContext(ctx))(
            input.userId,
            input.input,
          );
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
          await createChangeOwnPasswordHandler(createUsersContext(ctx))(
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

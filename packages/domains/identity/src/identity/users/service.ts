import { defineService, error, type Logger as BedrockLogger } from "@bedrock/core";
import {
  ConflictDomainError,
  DbToken,
  IdParamSchema,
  NotFoundDomainError,
  adaptBedrockLogger,
} from "@multihansa/common/bedrock";
import { createPaginatedListSchema } from "@multihansa/common/pagination";
import {
  BanUserInputSchema,
  ChangePasswordInputSchema,
  CreateUserInputSchema,
  ListUsersQuerySchema,
  UserSchema,
  UpdateUserInputSchema,
} from "./validation";
import {
  UserEmailConflictError,
  UserNotFoundError,
} from "./errors";
import { z } from "zod";

import { createUsersService as createUsersRuntime } from "./runtime";

const GetUserInputSchema = z.object({
  id: z.uuid(),
});

const UpdateUserActionInputSchema = z.object({
  id: z.uuid(),
  input: UpdateUserInputSchema,
});

const ChangePasswordActionInputSchema = z.object({
  id: z.uuid(),
  input: ChangePasswordInputSchema,
});

const BanUserActionInputSchema = z.object({
  id: z.uuid(),
  input: BanUserInputSchema,
});

const UnbanUserInputSchema = z.object({
  id: z.uuid(),
});

const UserWithLastSessionSchema = UserSchema.extend({
  lastSessionAt: z.date().nullable(),
  lastSessionIp: z.string().nullable(),
});

const PaginatedUsersSchema = createPaginatedListSchema(UserSchema);

function getUsersRuntime(ctx: {
  db: Parameters<typeof createUsersRuntime>[0]["db"];
  logger: BedrockLogger;
}) {
  return createUsersRuntime({
    db: ctx.db,
    logger: adaptBedrockLogger(ctx.logger),
  });
}

export const usersService = defineService("users", {
  deps: {
    db: DbToken,
  },
  ctx: ({ db }) => ({
    db,
  }),
  actions: ({ action }) => ({
    list: action({
      input: ListUsersQuerySchema,
      output: PaginatedUsersSchema,
      handler: async ({ ctx, input }) => getUsersRuntime(ctx).list(input),
    }),
    get: action({
      input: GetUserInputSchema,
      output: UserWithLastSessionSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await getUsersRuntime(ctx).findById(input.id);
        } catch (cause) {
          if (cause instanceof UserNotFoundError) {
            return error(NotFoundDomainError, {
              message: cause.message,
            });
          }

          throw cause;
        }
      },
    }),
    create: action({
      input: CreateUserInputSchema,
      output: UserSchema,
      errors: [ConflictDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await getUsersRuntime(ctx).create(input);
        } catch (cause) {
          if (cause instanceof UserEmailConflictError) {
            return error(ConflictDomainError, {
              message: cause.message,
            });
          }

          throw cause;
        }
      },
    }),
    update: action({
      input: UpdateUserActionInputSchema,
      output: UserSchema,
      errors: [NotFoundDomainError, ConflictDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await getUsersRuntime(ctx).update(input.id, input.input);
        } catch (cause) {
          if (cause instanceof UserNotFoundError) {
            return error(NotFoundDomainError, {
              message: cause.message,
            });
          }

          if (cause instanceof UserEmailConflictError) {
            return error(ConflictDomainError, {
              message: cause.message,
            });
          }

          throw cause;
        }
      },
    }),
    changePassword: action({
      input: ChangePasswordActionInputSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          await getUsersRuntime(ctx).changePassword(input.id, input.input);
          return undefined;
        } catch (cause) {
          if (cause instanceof UserNotFoundError) {
            return error(NotFoundDomainError, {
              message: cause.message,
            });
          }

          throw cause;
        }
      },
    }),
    ban: action({
      input: BanUserActionInputSchema,
      output: UserSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await getUsersRuntime(ctx).ban(input.id, input.input);
        } catch (cause) {
          if (cause instanceof UserNotFoundError) {
            return error(NotFoundDomainError, {
              message: cause.message,
            });
          }

          throw cause;
        }
      },
    }),
    unban: action({
      input: UnbanUserInputSchema,
      output: UserSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await getUsersRuntime(ctx).unban(input.id);
        } catch (cause) {
          if (cause instanceof UserNotFoundError) {
            return error(NotFoundDomainError, {
              message: cause.message,
            });
          }

          throw cause;
        }
      },
    }),
  }),
});

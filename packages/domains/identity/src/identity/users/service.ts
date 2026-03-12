import { defineService, error, type Logger as BedrockLogger } from "@bedrock/core";
import { z } from "zod";

import {
  ConflictDomainError,
  DbToken,
  IdParamSchema,
  NotFoundDomainError,
  adaptBedrockLogger,
} from "@multihansa/common/bedrock";
import { createPaginatedListSchema } from "@multihansa/common/pagination";

import {
  createBanUserHandler,
  createUnbanUserHandler,
} from "./commands/ban-user";
import { createChangePasswordHandler } from "./commands/change-password";
import { createCreateUserHandler } from "./commands/create-user";
import { createGetUserHandler } from "./commands/get-user";
import { createListUsersHandler } from "./commands/list-users";
import { createUpdateUserHandler } from "./commands/update-user";
import {
  UserEmailConflictError,
  UserNotFoundError,
} from "./errors";
import { createUsersServiceContext } from "./internal/context";
import {
  BanUserInputSchema,
  ChangePasswordInputSchema,
  CreateUserInputSchema,
  ListUsersQuerySchema,
  UserSchema,
  UpdateUserInputSchema,
} from "./validation";

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

function createUsersContext(ctx: {
  db: Parameters<typeof createUsersServiceContext>[0]["db"];
  logger: BedrockLogger;
}) {
  return createUsersServiceContext({
    db: ctx.db,
    logger: adaptBedrockLogger(ctx.logger),
  });
}

export const usersService = defineService("users", {
  deps: {
    db: DbToken,
  },
  actions: ({ action }) => ({
    list: action({
      input: ListUsersQuerySchema,
      output: PaginatedUsersSchema,
      handler: async ({ ctx, input }) =>
        createListUsersHandler(createUsersContext(ctx))(input),
    }),
    get: action({
      input: GetUserInputSchema,
      output: UserWithLastSessionSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await createGetUserHandler(createUsersContext(ctx))(input.id);
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
          return await createCreateUserHandler(createUsersContext(ctx))(input);
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
          return await createUpdateUserHandler(createUsersContext(ctx))(
            input.id,
            input.input,
          );
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
          await createChangePasswordHandler(createUsersContext(ctx))(
            input.id,
            input.input,
          );
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
          return await createBanUserHandler(createUsersContext(ctx))(
            input.id,
            input.input,
          );
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
          return await createUnbanUserHandler(createUsersContext(ctx))(input.id);
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

import {
  createBanUserHandler,
  createChangeOwnPasswordHandler,
  createChangePasswordHandler,
  createCreateUserHandler,
  createUnbanUserHandler,
  createUpdateUserHandler,
} from "./application/commands";
import {
  createGetUserHandler,
  createListUsersHandler,
} from "./application/queries";
import {
  createUsersServiceContext,
  type UsersServiceDeps,
} from "./application/shared/context";

export type { UsersServiceDeps } from "./application/shared/context";

export type UsersService = ReturnType<typeof createUsersService>;

export function createUsersService(deps: UsersServiceDeps) {
  const context = createUsersServiceContext(deps);

  const list = createListUsersHandler(context);
  const findById = createGetUserHandler(context);
  const create = createCreateUserHandler(context);
  const update = createUpdateUserHandler(context);
  const changePassword = createChangePasswordHandler(context);
  const changeOwnPassword = createChangeOwnPasswordHandler(context);
  const ban = createBanUserHandler(context);
  const unban = createUnbanUserHandler(context);

  return {
    list,
    findById,
    create,
    update,
    changePassword,
    changeOwnPassword,
    ban,
    unban,
  };
}

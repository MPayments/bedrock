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
  createIamServiceContext,
  type IamServiceDeps,
} from "./application/shared/context";

export type { IamServiceDeps } from "./application/shared/context";

export type IamService = ReturnType<typeof createIamService>;

export function createIamService(deps: IamServiceDeps) {
  const context = createIamServiceContext(deps);

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

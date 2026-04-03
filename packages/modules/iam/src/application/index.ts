import { BanUserCommand } from "./commands/ban-user";
import { ChangeOwnPasswordCommand } from "./commands/change-own-password";
import { ChangePasswordCommand } from "./commands/change-password";
import { CreateUserCommand } from "./commands/create-user";
import { UnbanUserCommand } from "./commands/unban-user";
import { UpdateUserCommand } from "./commands/update-user";
import { FindUserByIdQuery } from "./queries/find-user-by-id";
import { ListUsersQuery } from "./queries/list-users";
import {
  createIamServiceContext,
  type IamServiceDeps,
} from "./shared/context";

export type { IamServiceDeps } from "./shared/context";

export function createIamService(deps: IamServiceDeps) {
  const context = createIamServiceContext(deps);

  const createUser = new CreateUserCommand(
    context.runtime,
    context.commandUow,
    context.passwordHasher,
  );
  const updateUser = new UpdateUserCommand(
    context.runtime,
    context.commandUow,
  );
  const changePassword = new ChangePasswordCommand(
    context.runtime,
    context.commandUow,
    context.passwordHasher,
  );
  const changeOwnPassword = new ChangeOwnPasswordCommand(
    context.runtime,
    context.commandUow,
    context.passwordHasher,
  );
  const banUser = new BanUserCommand(
    context.runtime,
    context.commandUow,
  );
  const unbanUser = new UnbanUserCommand(
    context.runtime,
    context.commandUow,
  );
  const listUsers = new ListUsersQuery(context.reads);
  const findUserById = new FindUserByIdQuery(context.reads);

  return {
    commands: {
      create: createUser.execute.bind(createUser),
      update: updateUser.execute.bind(updateUser),
      changePassword: changePassword.execute.bind(changePassword),
      changeOwnPassword: changeOwnPassword.execute.bind(changeOwnPassword),
      ban: banUser.execute.bind(banUser),
      unban: unbanUser.execute.bind(unbanUser),
    },
    queries: {
      list: listUsers.execute.bind(listUsers),
      findById: findUserById.execute.bind(findUserById),
    },
  };
}

export type IamService = ReturnType<typeof createIamService>;

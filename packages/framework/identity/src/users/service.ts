import { createBanUserHandler, createUnbanUserHandler } from "./commands/ban-user";
import { createChangeOwnPasswordHandler } from "./commands/change-own-password";
import { createChangePasswordHandler } from "./commands/change-password";
import { createCreateUserHandler } from "./commands/create-user";
import { createGetUserHandler } from "./commands/get-user";
import { createListUsersHandler } from "./commands/list-users";
import { createUpdateUserHandler } from "./commands/update-user";
import {
    createUsersServiceContext,
    type UsersServiceDeps,
} from "./internal/context";

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

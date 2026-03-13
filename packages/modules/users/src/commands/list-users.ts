import { type PaginatedList } from "@bedrock/core/pagination";

import type { UsersServiceContext } from "../internal/context";
import { toUser } from "../internal/auth-users";
import {
  ListUsersQuerySchema,
  UserRoleSchema,
  type ListUsersQuery,
  type User,
} from "../validation";

export function createListUsersHandler(context: UsersServiceContext) {
  const { authStore } = context;

  return async function listUsers(
    input?: ListUsersQuery,
  ): Promise<PaginatedList<User>> {
    const query = ListUsersQuerySchema.parse(input ?? {});
    const result = await authStore.listUsers({
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      name: query.name,
      email: query.email,
      roles: query.role?.map((value) => UserRoleSchema.parse(value)),
      banned: query.banned,
    });

    return {
      ...result,
      data: result.data.map(toUser),
    };
  };
}

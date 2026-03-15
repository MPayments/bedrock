import { type PaginatedList } from "@bedrock/shared/core/pagination";

import {
  ListUsersQuerySchema,
  type ListUsersQuery,
  type User,
  type UserWithLastSession,
} from "../contracts";
import { UserNotFoundError } from "../errors";

import { toUser, toUserWithLastSession } from "./mappers";
import type { UsersServiceContext } from "./shared/context";

export function createGetUserHandler(context: UsersServiceContext) {
  const { identityQueries } = context;

  return async function getUser(id: string): Promise<UserWithLastSession> {
    const row = await identityQueries.getUserWithLastSession(id);

    if (!row) {
      throw new UserNotFoundError(id);
    }

    return toUserWithLastSession(row);
  };
}

export function createListUsersHandler(context: UsersServiceContext) {
  const { identityQueries } = context;

  return async function listUsers(
    input?: ListUsersQuery,
  ): Promise<PaginatedList<User>> {
    const query = ListUsersQuerySchema.parse(input ?? {});
    const result = await identityQueries.listUsers({
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      name: query.name,
      email: query.email,
      roles: query.role,
      banned: query.banned,
    });

    return {
      ...result,
      data: result.data.map(toUser),
    };
  };
}

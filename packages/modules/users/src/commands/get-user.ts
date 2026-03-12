import { UserNotFoundError } from "../errors";
import type { UsersServiceContext } from "../internal/context";
import { toUserWithLastSession } from "../internal/auth-users";
import type { User } from "../validation";

export interface UserWithLastSession extends User {
    lastSessionAt: Date | null;
    lastSessionIp: string | null;
}

export function createGetUserHandler(context: UsersServiceContext) {
  const { authStore } = context;

  return async function getUser(id: string): Promise<UserWithLastSession> {
    const row = await authStore.getUserWithLastSession(id);

    if (!row) {
      throw new UserNotFoundError(id);
    }

    return toUserWithLastSession(row);
  };
}

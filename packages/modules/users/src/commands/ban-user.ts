import { UserNotFoundError } from "../errors";
import type { UsersServiceContext } from "../internal/context";
import { toUser } from "../internal/auth-users";
import {
  BanUserInputSchema,
  type BanUserInput,
  type User,
} from "../validation";

export function createBanUserHandler(context: UsersServiceContext) {
  const { authStore, log } = context;

  return async function banUser(id: string, input: BanUserInput): Promise<User> {
    const validated = BanUserInputSchema.parse(input);
    const updated = await authStore.banUser({
      id,
      banReason: validated.banReason ?? null,
      banExpires: validated.banExpires ?? null,
    });

    if (!updated) {
      throw new UserNotFoundError(id);
    }

    log.info("User banned", { id, reason: validated.banReason });
    return toUser(updated);
  };
}

export function createUnbanUserHandler(context: UsersServiceContext) {
  const { authStore, log } = context;

  return async function unbanUser(id: string): Promise<User> {
    const updated = await authStore.unbanUser(id);

    if (!updated) {
      throw new UserNotFoundError(id);
    }

    log.info("User unbanned", { id });

    return toUser(updated);
  };
}

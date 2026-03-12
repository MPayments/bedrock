import { UserNotFoundError } from "../errors";
import type { UsersServiceContext } from "../internal/context";
import {
  ChangePasswordInputSchema,
  type ChangePasswordInput,
} from "../validation";

export function createChangePasswordHandler(context: UsersServiceContext) {
  const { authStore, passwordHasher, log } = context;

  return async function changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<void> {
    const validated = ChangePasswordInputSchema.parse(input);
    const existingUser = await authStore.findUserById(userId);

    if (!existingUser) {
      throw new UserNotFoundError(userId);
    }

    const passwordHash = await passwordHasher.hash(validated.newPassword);
    const updated = await authStore.updateCredentialPassword({
      userId,
      passwordHash,
    });

    if (!updated) {
      throw new UserNotFoundError(userId);
    }

    log.info("User password changed", { userId });
  };
}

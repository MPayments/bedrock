import { InvalidPasswordError, UserNotFoundError } from "../errors";
import type { UsersServiceContext } from "../internal/context";
import {
  ChangeOwnPasswordInputSchema,
  type ChangeOwnPasswordInput,
} from "../validation";

export function createChangeOwnPasswordHandler(context: UsersServiceContext) {
  const { authStore, passwordHasher, log } = context;

  return async function changeOwnPassword(
    userId: string,
    input: ChangeOwnPasswordInput,
  ): Promise<void> {
    const validated = ChangeOwnPasswordInputSchema.parse(input);
    const credentialAccount = await authStore.getCredentialByUserId(userId);

    if (!credentialAccount || !credentialAccount.password) {
      throw new UserNotFoundError(userId);
    }

    const valid = await passwordHasher.verify({
      hash: credentialAccount.password,
      password: validated.currentPassword,
    });

    if (!valid) {
      throw new InvalidPasswordError();
    }

    const passwordHash = await passwordHasher.hash(validated.newPassword);
    await authStore.updateCredentialPassword({ userId, passwordHash });

    log.info("User changed own password", { userId });
  };
}

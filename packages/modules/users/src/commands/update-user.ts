import { UserEmailConflictError, UserNotFoundError } from "../errors";
import type { UsersServiceContext } from "../internal/context";
import { toUser } from "../internal/auth-users";
import {
  UpdateUserInputSchema,
  type UpdateUserInput,
  type User,
} from "../validation";

export function createUpdateUserHandler(context: UsersServiceContext) {
  const { authStore, log } = context;

  return async function updateUser(
    id: string,
    input: UpdateUserInput,
  ): Promise<User> {
    const validated = UpdateUserInputSchema.parse(input);
    const existing = await authStore.findUserById(id);

    if (!existing) {
      throw new UserNotFoundError(id);
    }

    if (validated.email && validated.email !== existing.email) {
      const conflict = await authStore.findUserByEmail(validated.email);
      if (conflict && conflict.id !== id) {
        throw new UserEmailConflictError(validated.email);
      }
    }

    if (
      validated.name === undefined &&
      validated.email === undefined &&
      validated.role === undefined
    ) {
      return toUser(existing);
    }

    const updated = await authStore.updateUser({
      id,
      name: validated.name,
      email: validated.email,
      role: validated.role,
    });

    if (!updated) {
      throw new UserNotFoundError(id);
    }

    log.info("User updated", { id });
    return toUser(updated);
  };
}

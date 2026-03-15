import {
  InvalidPasswordError,
  UserEmailConflictError,
  UserNotFoundError,
} from "../errors";
import {
  BanUserInputSchema,
  ChangeOwnPasswordInputSchema,
  ChangePasswordInputSchema,
  CreateUserInputSchema,
  UpdateUserInputSchema,
  type BanUserInput,
  type ChangeOwnPasswordInput,
  type ChangePasswordInput,
  type CreateUserInput,
  type UpdateUserInput,
  type User,
} from "../contracts";

import { toUser } from "./mappers";
import type { UsersServiceContext } from "./shared/context";

export function createCreateUserHandler(context: UsersServiceContext) {
  const { identityStore, passwordHasher, log } = context;

  return async function createUser(input: CreateUserInput): Promise<User> {
    const validated = CreateUserInputSchema.parse(input);
    const existing = await identityStore.findUserByEmail(validated.email);

    if (existing) {
      throw new UserEmailConflictError(validated.email);
    }

    const passwordHash = await passwordHasher.hash(validated.password);
    const created = await identityStore.createUserWithCredential({
      name: validated.name,
      email: validated.email,
      role: validated.role,
      passwordHash,
      emailVerified: true,
    });

    log.info("User created", { id: created.id, email: created.email });

    return toUser(created);
  };
}

export function createUpdateUserHandler(context: UsersServiceContext) {
  const { identityStore, log } = context;

  return async function updateUser(
    id: string,
    input: UpdateUserInput,
  ): Promise<User> {
    const validated = UpdateUserInputSchema.parse(input);
    const existing = await identityStore.findUserById(id);

    if (!existing) {
      throw new UserNotFoundError(id);
    }

    if (validated.email && validated.email !== existing.email) {
      const conflict = await identityStore.findUserByEmail(validated.email);
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

    const updated = await identityStore.updateUser({
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

export function createChangePasswordHandler(context: UsersServiceContext) {
  const { identityStore, passwordHasher, log } = context;

  return async function changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<void> {
    const validated = ChangePasswordInputSchema.parse(input);
    const existingUser = await identityStore.findUserById(userId);

    if (!existingUser) {
      throw new UserNotFoundError(userId);
    }

    const passwordHash = await passwordHasher.hash(validated.newPassword);
    const updated = await identityStore.updateCredentialPassword({
      userId,
      passwordHash,
    });

    if (!updated) {
      throw new UserNotFoundError(userId);
    }

    log.info("User password changed", { userId });
  };
}

export function createChangeOwnPasswordHandler(context: UsersServiceContext) {
  const { identityStore, passwordHasher, log } = context;

  return async function changeOwnPassword(
    userId: string,
    input: ChangeOwnPasswordInput,
  ): Promise<void> {
    const validated = ChangeOwnPasswordInputSchema.parse(input);
    const credentialAccount = await identityStore.getCredentialByUserId(userId);

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
    await identityStore.updateCredentialPassword({ userId, passwordHash });

    log.info("User changed own password", { userId });
  };
}

export function createBanUserHandler(context: UsersServiceContext) {
  const { identityStore, log } = context;

  return async function banUser(id: string, input: BanUserInput): Promise<User> {
    const validated = BanUserInputSchema.parse(input);
    const updated = await identityStore.banUser({
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
  const { identityStore, log } = context;

  return async function unbanUser(id: string): Promise<User> {
    const updated = await identityStore.unbanUser(id);

    if (!updated) {
      throw new UserNotFoundError(id);
    }

    log.info("User unbanned", { id });

    return toUser(updated);
  };
}

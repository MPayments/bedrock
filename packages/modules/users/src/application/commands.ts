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
import { resolveBanUserInput, resolveUserUpdateInput } from "./inputs";
import { toUser } from "./mappers";
import { UserAccount } from "../domain/user-account";
import { toUserRoleOrNull } from "../domain/user-role";
import {
  InvalidPasswordError,
  UserEmailConflictError,
  UserNotFoundError,
} from "../errors";
import type { UsersServiceContext } from "./shared/context";

export function createCreateUserHandler(context: UsersServiceContext) {
  const { identityQueries, identityCommands, passwordHasher, log } = context;

  return async function createUser(input: CreateUserInput): Promise<User> {
    const validated = CreateUserInputSchema.parse(input);
    const email = UserAccount.normalizeEmail(validated.email);
    const name = UserAccount.normalizeName(validated.name);
    const existing = await identityQueries.findUserByEmail(email);

    if (existing) {
      throw new UserEmailConflictError(email);
    }

    const passwordHash = await passwordHasher.hash(validated.password);
    const created = await identityCommands.createUserWithCredential({
      name,
      email,
      role: validated.role,
      passwordHash,
      emailVerified: true,
    });

    log.info("User created", { id: created.id, email: created.email });

    return toUser(created);
  };
}

export function createUpdateUserHandler(context: UsersServiceContext) {
  const { identityQueries, identityCommands, log } = context;

  return async function updateUser(
    id: string,
    input: UpdateUserInput,
  ): Promise<User> {
    const validated = UpdateUserInputSchema.parse(input);
    const existing = await identityQueries.findUserById(id);

    if (!existing) {
      throw new UserNotFoundError(id);
    }

    const existingAccount = UserAccount.fromSnapshot({
      ...existing,
      role: toUserRoleOrNull(existing.role),
      banned: existing.banned ?? false,
      banExpires: existing.banExpires ?? null,
      twoFactorEnabled: existing.twoFactorEnabled ?? false,
    });
    const updatedAccount = existingAccount.updateProfile({
      ...resolveUserUpdateInput(existingAccount.toSnapshot(), validated),
      now: new Date(),
    });
    const updatedSnapshot = updatedAccount.toSnapshot();

    if (updatedSnapshot.email !== existing.email) {
      const conflict = await identityQueries.findUserByEmail(
        updatedSnapshot.email,
      );
      if (conflict && conflict.id !== id) {
        throw new UserEmailConflictError(updatedSnapshot.email);
      }
    }

    if (
      updatedSnapshot.name === existing.name &&
      updatedSnapshot.email === existing.email &&
      updatedSnapshot.role === existing.role
    ) {
      return toUser(existing);
    }

    const updated = await identityCommands.updateUser({
      id,
      name: updatedSnapshot.name,
      email: updatedSnapshot.email,
      role: updatedSnapshot.role,
    });

    if (!updated) {
      throw new UserNotFoundError(id);
    }

    log.info("User updated", { id });
    return toUser(updated);
  };
}

export function createChangePasswordHandler(context: UsersServiceContext) {
  const { identityQueries, identityCommands, passwordHasher, log } = context;

  return async function changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<void> {
    const validated = ChangePasswordInputSchema.parse(input);
    const existingUser = await identityQueries.findUserById(userId);

    if (!existingUser) {
      throw new UserNotFoundError(userId);
    }

    const passwordHash = await passwordHasher.hash(validated.newPassword);
    const updated = await identityCommands.updateCredentialPassword({
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
  const { identityQueries, identityCommands, passwordHasher, log } = context;

  return async function changeOwnPassword(
    userId: string,
    input: ChangeOwnPasswordInput,
  ): Promise<void> {
    const validated = ChangeOwnPasswordInputSchema.parse(input);
    const credentialAccount =
      await identityQueries.getCredentialByUserId(userId);

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
    await identityCommands.updateCredentialPassword({ userId, passwordHash });

    log.info("User changed own password", { userId });
  };
}

export function createBanUserHandler(context: UsersServiceContext) {
  const { identityQueries, identityCommands, log } = context;

  return async function banUser(
    id: string,
    input: BanUserInput,
  ): Promise<User> {
    const validated = BanUserInputSchema.parse(input);
    const existing = await identityQueries.findUserById(id);

    if (!existing) {
      throw new UserNotFoundError(id);
    }

    const updatedAccount = UserAccount.fromSnapshot({
      ...existing,
      role: toUserRoleOrNull(existing.role),
      banned: existing.banned ?? false,
      banExpires: existing.banExpires ?? null,
      twoFactorEnabled: existing.twoFactorEnabled ?? false,
    }).ban({
      ...resolveBanUserInput(validated),
      now: new Date(),
    });

    const updatedSnapshot = updatedAccount.toSnapshot();
    const updated = await identityCommands.banUser({
      id,
      banReason: updatedSnapshot.banReason,
      banExpires: updatedSnapshot.banExpires,
    });

    if (!updated) {
      throw new UserNotFoundError(id);
    }

    log.info("User banned", { id, reason: validated.banReason });
    return toUser(updated);
  };
}

export function createUnbanUserHandler(context: UsersServiceContext) {
  const { identityQueries, identityCommands, log } = context;

  return async function unbanUser(id: string): Promise<User> {
    const existing = await identityQueries.findUserById(id);

    if (!existing) {
      throw new UserNotFoundError(id);
    }

    const updatedAccount = UserAccount.fromSnapshot({
      ...existing,
      role: toUserRoleOrNull(existing.role),
      banned: existing.banned ?? false,
      banExpires: existing.banExpires ?? null,
      twoFactorEnabled: existing.twoFactorEnabled ?? false,
    }).unban(new Date());

    const updated = await identityCommands.unbanUser(updatedAccount.id);

    if (!updated) {
      throw new UserNotFoundError(id);
    }

    log.info("User unbanned", { id });

    return toUser(updated);
  };
}

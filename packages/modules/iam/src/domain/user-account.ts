import {
  AggregateRoot,
  normalizeOptionalText,
  normalizeRequiredText,
} from "@bedrock/shared/core";

import { UserEmail } from "./user-email";
import {
  shouldProvisionAgentProfile,
  type UserRole,
  toUserRoleOrNull,
} from "./user-role";

export interface CreateUserAccountProps {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
  role: UserRole | null;
}

export interface UpdateUserProfileProps {
  name: string;
  email: string;
  role: UserRole | null;
}

export interface BanUserProps {
  banReason: string | null;
  banExpires: Date | null;
}

export interface UserAccountSnapshot {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: UserRole | null;
  banned: boolean;
  banReason: string | null;
  banExpires: Date | null;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function normalizeUserAccountSnapshot(
  snapshot: UserAccountSnapshot,
): UserAccountSnapshot {
  return {
    ...snapshot,
    name: UserAccount.normalizeName(snapshot.name),
    email: UserAccount.normalizeEmail(snapshot.email),
    image: normalizeOptionalText(snapshot.image),
    role: toUserRoleOrNull(snapshot.role ?? null),
    banReason: normalizeOptionalText(snapshot.banReason),
    banExpires: snapshot.banExpires ?? null,
  };
}

export class UserAccount extends AggregateRoot<string> {
  private readonly snapshot: UserAccountSnapshot;

  private constructor(snapshot: UserAccountSnapshot) {
    super({ id: snapshot.id, props: {} });
    this.snapshot = normalizeUserAccountSnapshot(snapshot);
  }

  static create(
    input: CreateUserAccountProps,
    now: Date,
  ): UserAccount {
    return new UserAccount({
      id: input.id,
      name: input.name,
      email: input.email,
      emailVerified: input.emailVerified ?? true,
      image: input.image ?? null,
      role: input.role,
      banned: false,
      banReason: null,
      banExpires: null,
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromSnapshot(snapshot: UserAccountSnapshot): UserAccount {
    return new UserAccount({ ...snapshot });
  }

  static normalizeName(name: string): string {
    return normalizeRequiredText(name, "user.name.required", "name");
  }

  static normalizeEmail(email: string): string {
    return UserEmail.create(email).value;
  }

  updateProfile(input: UpdateUserProfileProps & { now: Date }): UserAccount {
    return new UserAccount({
      ...this.snapshot,
      name: UserAccount.normalizeName(input.name),
      email: UserAccount.normalizeEmail(input.email),
      role: toUserRoleOrNull(input.role),
      updatedAt: input.now,
    });
  }

  ban(input: BanUserProps & { now: Date }): UserAccount {
    return new UserAccount({
      ...this.snapshot,
      banned: true,
      banReason: normalizeOptionalText(input.banReason),
      banExpires: input.banExpires,
      updatedAt: input.now,
    });
  }

  unban(now: Date): UserAccount {
    return new UserAccount({
      ...this.snapshot,
      banned: false,
      banReason: null,
      banExpires: null,
      updatedAt: now,
    });
  }

  requiresAgentProfile(): boolean {
    return shouldProvisionAgentProfile(this.snapshot.role);
  }

  sameState(other: UserAccount): boolean {
    const left = this.snapshot;
    const right = other.snapshot;

    return (
      left.name === right.name &&
      left.email === right.email &&
      left.emailVerified === right.emailVerified &&
      left.image === right.image &&
      left.role === right.role &&
      left.banned === right.banned &&
      left.banReason === right.banReason &&
      left.banExpires?.getTime() === right.banExpires?.getTime() &&
      left.twoFactorEnabled === right.twoFactorEnabled
    );
  }

  toSnapshot(): UserAccountSnapshot {
    return { ...this.snapshot };
  }
}

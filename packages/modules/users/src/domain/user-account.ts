import {
  applyPatch,
  Entity,
  normalizeOptionalText,
  normalizeRequiredText,
} from "@bedrock/shared/core";

import { UserEmail } from "./user-email";
import { type UserRole, toUserRoleOrNull } from "./user-role";

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

export class UserAccount extends Entity<string> {
  private readonly snapshot: UserAccountSnapshot;

  private constructor(snapshot: UserAccountSnapshot) {
    super(snapshot.id);
    this.snapshot = normalizeUserAccountSnapshot(snapshot);
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

  updateProfile(input: {
    name?: string;
    email?: string;
    role?: UserRole | null;
    now: Date;
  }): UserAccount {
    const next = applyPatch(this.snapshot, {
      name:
        input.name === undefined
          ? undefined
          : UserAccount.normalizeName(input.name),
      email:
        input.email === undefined
          ? undefined
          : UserAccount.normalizeEmail(input.email),
      role:
        input.role === undefined ? undefined : toUserRoleOrNull(input.role),
    });

    return new UserAccount({
      ...next,
      updatedAt: input.now,
    });
  }

  ban(input: {
    banReason?: string;
    banExpires?: Date;
    now: Date;
  }): UserAccount {
    return new UserAccount({
      ...this.snapshot,
      banned: true,
      banReason: normalizeOptionalText(input.banReason),
      banExpires: input.banExpires ?? null,
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

  toSnapshot(): UserAccountSnapshot {
    return { ...this.snapshot };
  }
}

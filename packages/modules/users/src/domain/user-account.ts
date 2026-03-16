import {
  Entity,
  normalizeOptionalText,
  normalizeRequiredText,
} from "@bedrock/shared/core/domain";

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

  static reconstitute(snapshot: UserAccountSnapshot): UserAccount {
    return new UserAccount({ ...snapshot });
  }

  static normalizeName(name: string): string {
    return normalizeRequiredText(name, "user.name.required", "name");
  }

  static normalizeEmail(email: string): string {
    return UserEmail.create(email).value;
  }

  updateProfile(input: {
    name: string;
    email: string;
    role: UserRole | null;
    now: Date;
  }): UserAccount {
    return new UserAccount({
      ...this.snapshot,
      name: UserAccount.normalizeName(input.name),
      email: UserAccount.normalizeEmail(input.email),
      role: toUserRoleOrNull(input.role),
      updatedAt: input.now,
    });
  }

  ban(input: {
    reason: string | null;
    expiresAt: Date | null;
    now: Date;
  }): UserAccount {
    return new UserAccount({
      ...this.snapshot,
      banned: true,
      banReason: normalizeOptionalText(input.reason),
      banExpires: input.expiresAt,
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

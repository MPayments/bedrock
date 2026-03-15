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

export class UserAccount extends Entity<string> {
  private constructor(private readonly snapshot: UserAccountSnapshot) {
    super(snapshot.id);
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
    name?: string;
    email?: string;
    role?: string | null;
    now: Date;
  }): UserAccount {
    return new UserAccount({
      ...this.snapshot,
      name:
        input.name !== undefined
          ? UserAccount.normalizeName(input.name)
          : this.snapshot.name,
      email:
        input.email !== undefined
          ? UserAccount.normalizeEmail(input.email)
          : this.snapshot.email,
      role:
        input.role !== undefined
          ? toUserRoleOrNull(input.role)
          : this.snapshot.role,
      updatedAt: input.now,
    });
  }

  ban(input: {
    reason?: string | null;
    expiresAt?: Date | null;
    now: Date;
  }): UserAccount {
    return new UserAccount({
      ...this.snapshot,
      banned: true,
      banReason: normalizeOptionalText(input.reason),
      banExpires: input.expiresAt ?? null,
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

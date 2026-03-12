import type { AuthUserRecord, AuthUserWithLastSession } from "@bedrock/auth";

import type { User, UserRole } from "../validation";
import type { UserWithLastSession } from "../commands/get-user";

export function toUser(row: AuthUserRecord): User {
  return {
    ...row,
    role: row.role as UserRole | null,
    banned: row.banned ?? false,
    banExpires: row.banExpires ?? null,
  };
}

export function toUserWithLastSession(
  row: AuthUserWithLastSession,
): UserWithLastSession {
  return {
    ...toUser(row.user),
    lastSessionAt: row.lastSessionAt,
    lastSessionIp: row.lastSessionIp,
  };
}

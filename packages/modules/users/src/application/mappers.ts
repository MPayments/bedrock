import type { User, UserWithLastSession } from "../contracts";
import { toUserRoleOrNull } from "../domain/user-role";
import type {
  UsersUserRecord,
  UsersUserWithLastSessionRecord,
} from "./users/ports";

export function toUser(row: UsersUserRecord): User {
  return {
    ...row,
    role: toUserRoleOrNull(row.role),
    banned: row.banned ?? false,
    banExpires: row.banExpires ?? null,
  };
}

export function toUserWithLastSession(
  row: UsersUserWithLastSessionRecord,
): UserWithLastSession {
  return {
    ...toUser(row.user),
    lastSessionAt: row.lastSessionAt,
    lastSessionIp: row.lastSessionIp,
  };
}

export const USER_ROLE_VALUES = ["admin", "user"] as const;

export type UserRole = (typeof USER_ROLE_VALUES)[number];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLE_VALUES as readonly string[]).includes(value);
}

export function toUserRoleOrNull(value: string | null): UserRole | null {
  if (value === null) {
    return null;
  }

  return isUserRole(value) ? value : null;
}

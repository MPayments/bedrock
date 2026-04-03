export const USER_ROLE_VALUES = [
  "admin",
  "user",
  "agent",
  "customer",
  "finance",
] as const;

export type UserRole = (typeof USER_ROLE_VALUES)[number];

export const AGENT_PROFILE_ROLE_VALUES = ["agent", "admin"] as const;

export const INTERNAL_APP_ROLE_VALUES = ["admin", "agent", "finance"] as const;

export type InternalAppRole = (typeof INTERNAL_APP_ROLE_VALUES)[number];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLE_VALUES as readonly string[]).includes(value);
}

export function toUserRoleOrNull(value: string | null): UserRole | null {
  if (value === null) {
    return null;
  }

  return isUserRole(value) ? value : null;
}

export function shouldProvisionAgentProfile(role: UserRole | null): boolean {
  return (
    role !== null &&
    (AGENT_PROFILE_ROLE_VALUES as readonly UserRole[]).includes(role)
  );
}

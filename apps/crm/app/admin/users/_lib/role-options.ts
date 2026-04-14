import type { RoleOption } from "@bedrock/sdk-users-ui/lib/contracts";

/**
 * Roles available when creating or editing a user in CRM.
 */
export const CRM_USER_ROLE_OPTIONS: readonly RoleOption[] = [
  { value: "admin", label: "Админ" },
  { value: "agent", label: "Агент" },
] as const;

/**
 * All known roles with display labels — used for rendering the users list.
 * The backend may return users with roles created by other apps (e.g., finance),
 * so the list needs a wider map than the create/edit selects.
 */
export const CRM_USER_ROLE_DISPLAY_OPTIONS: readonly RoleOption[] = [
  { value: "admin", label: "Админ" },
  { value: "agent", label: "Агент" },
  { value: "finance", label: "Казначей" },
  { value: "user", label: "Пользователь" },
  { value: "customer", label: "Клиент" },
] as const;

export const CRM_DEFAULT_USER_ROLE = "agent";

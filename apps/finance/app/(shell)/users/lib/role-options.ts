import type { RoleOption } from "@bedrock/sdk-users-ui/lib/contracts";

/**
 * Roles available when creating or editing a user in the finance app.
 */
export const FINANCE_USER_ROLE_OPTIONS: readonly RoleOption[] = [
  { value: "admin", label: "Админ" },
  { value: "finance", label: "Казначей" },
] as const;

/**
 * All known role labels — used for rendering the users list. The backend may
 * return users with roles created by other apps (e.g., CRM's `agent`), so the
 * list needs a wider map than the create/edit selects.
 */
export const FINANCE_USER_ROLE_DISPLAY_OPTIONS: readonly RoleOption[] = [
  { value: "admin", label: "Админ" },
  { value: "finance", label: "Казначей" },
  { value: "agent", label: "Агент" },
  { value: "user", label: "Пользователь" },
  { value: "customer", label: "Клиент" },
] as const;

export const FINANCE_DEFAULT_USER_ROLE = "finance";

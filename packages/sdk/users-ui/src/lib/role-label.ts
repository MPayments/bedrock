import type { RoleOption } from "./contracts";

export function createRoleLabelResolver(options: readonly RoleOption[]) {
  const map = new Map(options.map((option) => [option.value, option.label]));
  return function resolveRoleLabel(role: string | null | undefined): string {
    if (!role) {
      return options[0]?.label ?? "";
    }
    return map.get(role) ?? role;
  };
}

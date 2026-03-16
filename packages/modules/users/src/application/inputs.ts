import type { UpdateUserInput } from "../contracts";
import type { UserAccountSnapshot } from "../domain/user-account";

export function resolveUserUpdateInput(
  current: UserAccountSnapshot,
  patch: UpdateUserInput,
) {
  return {
    name: patch.name ?? current.name,
    email: patch.email ?? current.email,
    role: patch.role ?? current.role,
  };
}

export function resolveBanUserInput(input: {
  banReason?: string;
  banExpires?: Date;
}) {
  return {
    reason: input.banReason ?? null,
    expiresAt: input.banExpires ?? null,
  };
}

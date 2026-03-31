import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  basePath: "/api/auth/crm",
  plugins: [adminClient()],
});

export const { useSession, signIn, signOut, signUp } = authClient;

export function isAdminUser(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === "admin";
}

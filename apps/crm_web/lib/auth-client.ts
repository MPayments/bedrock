import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003";
const baseURL = `${apiUrl}/api/auth`;

export const authClient = createAuthClient({
  baseURL,
  plugins: [adminClient()],
});

export const { useSession, signIn, signOut, signUp } = authClient;

export function isAdminUser(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === "admin";
}

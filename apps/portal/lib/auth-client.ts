import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const baseURL = `${apiUrl}/api/auth`;

export const authClient = createAuthClient({
  baseURL,
  plugins: [adminClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;

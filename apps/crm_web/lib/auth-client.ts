import { createAuthClient } from "better-auth/react";

const isServer = typeof window === "undefined";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003";
const baseURL = isServer ? `${apiUrl}/api/auth` : "/api/auth";

export const authClient = createAuthClient({
  baseURL,
});

export const { useSession, signIn, signOut, signUp } = authClient;

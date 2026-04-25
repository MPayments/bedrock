import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  basePath: "/api/auth/portal",
});

export const { signOut } = authClient;

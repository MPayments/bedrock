import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  basePath: "/api/auth/crm",
  plugins: [adminClient()],
});

export const { useSession, signIn, signOut } = authClient;

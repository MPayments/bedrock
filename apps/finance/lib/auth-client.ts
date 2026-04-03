import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  basePath: "/api/auth/finance",
  plugins: [twoFactorClient()],
});

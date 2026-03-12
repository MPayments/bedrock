import { createAuthClient } from "better-auth/client";
import { admin as adminPlugin } from "better-auth/plugins";
import { twoFactorClient } from "better-auth/client/plugins";

import { ac, admin, user } from "./permissions";

export const authClient = createAuthClient({
    baseURL: process.env.BETTER_AUTH_URL!,
    basePath: "/api/auth",
    fetchOptions: {
        credentials: "include",
    },
    plugins: [
        adminPlugin({
            ac,
            admin,
            user,
        }),
        twoFactorClient(),
    ],
});
